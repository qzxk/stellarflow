"""
Stellar API Python Client Example
A complete example showing how to interact with the Stellar API
"""

import requests
import json
from typing import Dict, Optional, Any
from datetime import datetime, timedelta
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StellarAPIClient:
    """
    Python client for interacting with the Stellar API
    """
    
    def __init__(self, base_url: str = 'http://localhost:3000/api/v1'):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json'
        })
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make authenticated HTTP requests with automatic retry and token refresh"""
        url = f"{self.base_url}{endpoint}"
        
        # Add auth header if we have a token
        if self.access_token:
            self.session.headers['Authorization'] = f'Bearer {self.access_token}'
        
        # Check if token needs refresh (5 minutes before expiry)
        if self.token_expiry and datetime.now() >= self.token_expiry - timedelta(minutes=5):
            self.refresh_access_token()
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                response = self.session.request(method, url, **kwargs)
                
                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = int(response.headers.get('retry-after', 60))
                    logger.warning(f"Rate limited. Waiting {retry_after} seconds...")
                    time.sleep(retry_after)
                    continue
                
                # Handle unauthorized (token expired)
                if response.status_code == 401 and self.refresh_token and attempt == 0:
                    logger.info("Access token expired, refreshing...")
                    self.refresh_access_token()
                    continue
                
                # Raise exception for error responses
                response.raise_for_status()
                
                return response.json()
                
            except requests.exceptions.RequestException as e:
                if attempt == max_retries - 1:
                    raise APIError(f"Request failed after {max_retries} attempts: {str(e)}")
                
                # Exponential backoff
                wait_time = 2 ** attempt
                logger.warning(f"Request failed, retrying in {wait_time} seconds...")
                time.sleep(wait_time)
    
    def set_tokens(self, tokens: Dict[str, Any]) -> None:
        """Store authentication tokens"""
        self.access_token = tokens.get('accessToken')
        self.refresh_token = tokens.get('refreshToken')
        
        # Calculate token expiry time
        expires_in = tokens.get('expiresIn', 3600)
        self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
    
    def clear_tokens(self) -> None:
        """Clear stored tokens"""
        self.access_token = None
        self.refresh_token = None
        self.token_expiry = None
        self.session.headers.pop('Authorization', None)
    
    # Authentication endpoints
    def register(self, username: str, email: str, password: str, 
                 profile: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Register a new user"""
        data = {
            'username': username,
            'email': email,
            'password': password
        }
        if profile:
            data['profile'] = profile
        
        return self._request('POST', '/auth/register', json=data)
    
    def login(self, identifier: str, password: str, remember_me: bool = False) -> Dict[str, Any]:
        """Login and obtain access tokens"""
        response = self._request('POST', '/auth/login', json={
            'identifier': identifier,
            'password': password,
            'rememberMe': remember_me
        })
        
        self.set_tokens(response['tokens'])
        return response
    
    def logout(self) -> Dict[str, Any]:
        """Logout and invalidate tokens"""
        try:
            response = self._request('POST', '/auth/logout', json={
                'refreshToken': self.refresh_token
            })
        finally:
            self.clear_tokens()
        
        return response
    
    def refresh_access_token(self) -> Dict[str, Any]:
        """Refresh the access token using refresh token"""
        if not self.refresh_token:
            raise APIError("No refresh token available")
        
        response = self._request('POST', '/auth/refresh', json={
            'refreshToken': self.refresh_token
        })
        
        self.access_token = response['tokens']['accessToken']
        expires_in = response['tokens'].get('expiresIn', 3600)
        self.token_expiry = datetime.now() + timedelta(seconds=expires_in)
        
        return response
    
    def verify_email(self, token: str) -> Dict[str, Any]:
        """Verify email address with token"""
        return self._request('GET', f'/auth/verify-email?token={token}')
    
    def forgot_password(self, email: str) -> Dict[str, Any]:
        """Request password reset"""
        return self._request('POST', '/auth/forgot-password', json={'email': email})
    
    def reset_password(self, token: str, new_password: str) -> Dict[str, Any]:
        """Reset password with token"""
        return self._request('POST', '/auth/reset-password', json={
            'token': token,
            'newPassword': new_password
        })
    
    # User endpoints
    def get_profile(self) -> Dict[str, Any]:
        """Get current user profile"""
        return self._request('GET', '/users/profile')
    
    def update_profile(self, updates: Dict[str, Any]) -> Dict[str, Any]:
        """Update user profile"""
        return self._request('PUT', '/users/profile', json=updates)
    
    def change_password(self, current_password: str, new_password: str) -> Dict[str, Any]:
        """Change user password"""
        return self._request('POST', '/users/change-password', json={
            'currentPassword': current_password,
            'newPassword': new_password
        })
    
    def upload_avatar(self, image_path: str) -> Dict[str, Any]:
        """Upload avatar image"""
        # Temporarily remove Content-Type for multipart upload
        del self.session.headers['Content-Type']
        
        try:
            with open(image_path, 'rb') as f:
                files = {'avatar': f}
                response = self._request('POST', '/users/avatar', files=files)
        finally:
            # Restore Content-Type
            self.session.headers['Content-Type'] = 'application/json'
        
        return response
    
    def delete_account(self, password: str) -> Dict[str, Any]:
        """Delete user account"""
        try:
            response = self._request('DELETE', '/users/delete', json={'password': password})
        finally:
            self.clear_tokens()
        
        return response
    
    # Admin endpoints
    def get_user(self, user_id: str) -> Dict[str, Any]:
        """Get user by ID (admin only)"""
        return self._request('GET', f'/users/{user_id}')
    
    def list_users(self, page: int = 1, limit: int = 20, sort: str = '-createdAt',
                   status: Optional[str] = None, role: Optional[str] = None,
                   search: Optional[str] = None) -> Dict[str, Any]:
        """List users with pagination (admin only)"""
        params = {
            'page': page,
            'limit': limit,
            'sort': sort
        }
        
        if status:
            params['status'] = status
        if role:
            params['role'] = role
        if search:
            params['search'] = search
        
        return self._request('GET', '/users', params=params)
    
    # Health check
    def check_health(self) -> Dict[str, Any]:
        """Check API health status"""
        return self._request('GET', '/health')


class APIError(Exception):
    """Custom exception for API errors"""
    pass


class ResilientStellarClient(StellarAPIClient):
    """
    Enhanced client with additional resilience features
    """
    
    def __init__(self, base_url: str = 'http://localhost:3000/api/v1'):
        super().__init__(base_url)
        self.circuit_breaker = CircuitBreaker()
    
    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Enhanced request with circuit breaker pattern"""
        return self.circuit_breaker.call(
            lambda: super()._request(method, endpoint, **kwargs)
        )


class CircuitBreaker:
    """
    Simple circuit breaker implementation
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
    
    def call(self, func):
        if self.state == 'open':
            if datetime.now().timestamp() - self.last_failure_time > self.recovery_timeout:
                self.state = 'half-open'
            else:
                raise APIError("Circuit breaker is open")
        
        try:
            result = func()
            if self.state == 'half-open':
                self.state = 'closed'
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = datetime.now().timestamp()
            
            if self.failure_count >= self.failure_threshold:
                self.state = 'open'
                logger.error(f"Circuit breaker opened after {self.failure_count} failures")
            
            raise e


# Example usage
def main():
    """Example usage of the Stellar API client"""
    client = StellarAPIClient()
    
    try:
        # Check API health
        print("Checking API health...")
        health = client.check_health()
        print(f"API Status: {health['status']}")
        
        # Register a new user
        print("\nRegistering new user...")
        register_response = client.register(
            username='pythonuser',
            email='python@example.com',
            password='SecurePassword123!',
            profile={
                'firstName': 'Python',
                'lastName': 'User'
            }
        )
        print(f"Registration successful: {register_response['message']}")
        
        # Login
        print("\nLogging in...")
        login_response = client.login('python@example.com', 'SecurePassword123!', remember_me=True)
        print(f"Login successful! User: {login_response['user']['username']}")
        
        # Get profile
        print("\nFetching profile...")
        profile_response = client.get_profile()
        print(f"Profile: {json.dumps(profile_response['user'], indent=2)}")
        
        # Update profile
        print("\nUpdating profile...")
        update_response = client.update_profile({
            'profile': {
                'bio': 'Python developer building awesome APIs',
                'phoneNumber': '+1-555-987-6543'
            }
        })
        print(f"Profile updated: {update_response['user']['profile']}")
        
        # Change password
        print("\nChanging password...")
        password_response = client.change_password(
            'SecurePassword123!',
            'NewSecurePassword123!'
        )
        print(f"Password changed: {password_response['message']}")
        
        # Logout
        print("\nLogging out...")
        client.logout()
        print("Logged out successfully")
        
    except APIError as e:
        print(f"API Error: {e}")
    except Exception as e:
        print(f"Error: {e}")


# Advanced example: Context manager for automatic session handling
class StellarAPISession:
    """Context manager for Stellar API sessions"""
    
    def __init__(self, base_url: str = 'http://localhost:3000/api/v1'):
        self.client = StellarAPIClient(base_url)
        self.credentials = None
    
    def login(self, identifier: str, password: str) -> 'StellarAPISession':
        """Store credentials for automatic login"""
        self.credentials = (identifier, password)
        return self
    
    def __enter__(self) -> StellarAPIClient:
        """Automatically login when entering context"""
        if self.credentials:
            self.client.login(*self.credentials)
        return self.client
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Automatically logout when exiting context"""
        try:
            self.client.logout()
        except Exception:
            pass  # Ignore logout errors


# Example using context manager
def context_manager_example():
    """Example using the context manager for automatic session handling"""
    
    with StellarAPISession().login('python@example.com', 'SecurePassword123!') as api:
        # Automatically logged in
        profile = api.get_profile()
        print(f"Logged in as: {profile['user']['username']}")
        
        # Do some work...
        api.update_profile({
            'profile': {
                'bio': 'Using context manager!'
            }
        })
    
    # Automatically logged out


if __name__ == '__main__':
    main()
    # context_manager_example()