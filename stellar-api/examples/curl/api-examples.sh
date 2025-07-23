#!/bin/bash

# Stellar API cURL Examples
# Complete examples showing how to interact with the Stellar API using cURL

# Configuration
BASE_URL="http://localhost:3000/api/v1"
ACCESS_TOKEN=""
REFRESH_TOKEN=""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_header() {
    echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Helper function to parse JSON (requires jq)
parse_json() {
    if command -v jq &> /dev/null; then
        echo "$1" | jq -r "$2"
    else
        echo "jq not installed. Raw response: $1"
    fi
}

# 1. Health Check
health_check() {
    print_header "Health Check"
    
    response=$(curl -s -X GET "$BASE_URL/health")
    status=$(parse_json "$response" ".status")
    
    if [ "$status" = "healthy" ]; then
        print_success "API is healthy"
    else
        print_error "API health check failed"
    fi
    
    echo "Response: $response"
}

# 2. Register New User
register_user() {
    print_header "Register New User"
    
    # Generate random username and email
    RANDOM_ID=$RANDOM
    USERNAME="testuser$RANDOM_ID"
    EMAIL="test$RANDOM_ID@example.com"
    PASSWORD="SecurePassword123!"
    
    response=$(curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "'$USERNAME'",
            "email": "'$EMAIL'",
            "password": "'$PASSWORD'",
            "profile": {
                "firstName": "Test",
                "lastName": "User"
            }
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        print_success "User registered successfully"
        echo "Username: $USERNAME"
        echo "Email: $EMAIL"
        
        # Save credentials for later use
        echo "$EMAIL:$PASSWORD" > .test_credentials
    else
        print_error "Registration failed"
    fi
    
    echo "Response: $response"
}

# 3. Login
login() {
    print_header "Login"
    
    # Read test credentials if available
    if [ -f .test_credentials ]; then
        IFS=':' read -r EMAIL PASSWORD < .test_credentials
    else
        EMAIL=${1:-"test@example.com"}
        PASSWORD=${2:-"TestPassword123!"}
    fi
    
    response=$(curl -s -X POST "$BASE_URL/auth/login" \
        -H "Content-Type: application/json" \
        -d '{
            "identifier": "'$EMAIL'",
            "password": "'$PASSWORD'",
            "rememberMe": true
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        ACCESS_TOKEN=$(parse_json "$response" ".tokens.accessToken")
        REFRESH_TOKEN=$(parse_json "$response" ".tokens.refreshToken")
        
        print_success "Login successful"
        echo "Access Token: ${ACCESS_TOKEN:0:50}..."
        
        # Save tokens for later use
        echo "ACCESS_TOKEN=$ACCESS_TOKEN" > .tokens
        echo "REFRESH_TOKEN=$REFRESH_TOKEN" >> .tokens
    else
        print_error "Login failed"
    fi
    
    echo "Response: $response"
}

# 4. Get Profile (Authenticated)
get_profile() {
    print_header "Get Profile"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available. Please login first."
        return 1
    fi
    
    response=$(curl -s -X GET "$BASE_URL/users/profile" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        print_success "Profile retrieved successfully"
        username=$(parse_json "$response" ".user.username")
        email=$(parse_json "$response" ".user.email")
        echo "Username: $username"
        echo "Email: $email"
    else
        print_error "Failed to get profile"
    fi
    
    echo "Response: $response"
}

# 5. Update Profile
update_profile() {
    print_header "Update Profile"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available. Please login first."
        return 1
    fi
    
    response=$(curl -s -X PUT "$BASE_URL/users/profile" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "profile": {
                "firstName": "Updated",
                "lastName": "Name",
                "bio": "Updated via cURL",
                "phoneNumber": "+1-555-123-4567"
            }
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        print_success "Profile updated successfully"
    else
        print_error "Failed to update profile"
    fi
    
    echo "Response: $response"
}

# 6. Change Password
change_password() {
    print_header "Change Password"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available. Please login first."
        return 1
    fi
    
    # Read current password
    if [ -f .test_credentials ]; then
        IFS=':' read -r EMAIL CURRENT_PASSWORD < .test_credentials
    else
        CURRENT_PASSWORD="TestPassword123!"
    fi
    
    NEW_PASSWORD="NewSecurePassword123!"
    
    response=$(curl -s -X POST "$BASE_URL/users/change-password" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "currentPassword": "'$CURRENT_PASSWORD'",
            "newPassword": "'$NEW_PASSWORD'"
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        print_success "Password changed successfully"
        
        # Update saved credentials
        if [ -f .test_credentials ]; then
            echo "$EMAIL:$NEW_PASSWORD" > .test_credentials
        fi
    else
        print_error "Failed to change password"
    fi
    
    echo "Response: $response"
}

# 7. Refresh Token
refresh_token() {
    print_header "Refresh Token"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$REFRESH_TOKEN" ]; then
        print_error "No refresh token available. Please login first."
        return 1
    fi
    
    response=$(curl -s -X POST "$BASE_URL/auth/refresh" \
        -H "Content-Type: application/json" \
        -d '{
            "refreshToken": "'$REFRESH_TOKEN'"
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        NEW_ACCESS_TOKEN=$(parse_json "$response" ".tokens.accessToken")
        ACCESS_TOKEN=$NEW_ACCESS_TOKEN
        
        print_success "Token refreshed successfully"
        echo "New Access Token: ${ACCESS_TOKEN:0:50}..."
        
        # Update saved tokens
        echo "ACCESS_TOKEN=$ACCESS_TOKEN" > .tokens
        echo "REFRESH_TOKEN=$REFRESH_TOKEN" >> .tokens
    else
        print_error "Failed to refresh token"
    fi
    
    echo "Response: $response"
}

# 8. Upload Avatar
upload_avatar() {
    print_header "Upload Avatar"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available. Please login first."
        return 1
    fi
    
    # Create a sample image file if it doesn't exist
    if [ ! -f "avatar.jpg" ]; then
        echo "Creating sample avatar.jpg..."
        # Create a 1x1 pixel JPEG (minimal valid JPEG)
        printf "\xFF\xD8\xFF\xE0\x00\x10\x4A\x46\x49\x46\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xDB\x00\x43\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\x09\x09\x08\x0A\x0C\x14\x0D\x0C\x0B\x0B\x0C\x19\x12\x13\x0F\x14\x1D\x1A\x1F\x1E\x1D\x1A\x1C\x1C\x20\x24\x2E\x27\x20\x22\x2C\x23\x1C\x1C\x28\x37\x29\x2C\x30\x31\x34\x34\x34\x1F\x27\x39\x3D\x38\x32\x3C\x2E\x33\x34\x32\xFF\xC0\x00\x0B\x08\x00\x01\x00\x01\x01\x01\x11\x00\xFF\xC4\x00\x1F\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\x09\x0A\x0B\xFF\xC4\x00\xB5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01\x7D\x01\x02\x03\x00\x04\x11\x05\x12\x21\x31\x41\x06\x13\x51\x61\x07\x22\x71\x14\x32\x81\x91\xA1\x08\x23\x42\xB1\xC1\x15\x52\xD1\xF0\x24\x33\x62\x72\x82\x09\x0A\x16\x17\x18\x19\x1A\x25\x26\x27\x28\x29\x2A\x34\x35\x36\x37\x38\x39\x3A\x43\x44\x45\x46\x47\x48\x49\x4A\x53\x54\x55\x56\x57\x58\x59\x5A\x63\x64\x65\x66\x67\x68\x69\x6A\x73\x74\x75\x76\x77\x78\x79\x7A\x83\x84\x85\x86\x87\x88\x89\x8A\x92\x93\x94\x95\x96\x97\x98\x99\x9A\xA2\xA3\xA4\xA5\xA6\xA7\xA8\xA9\xAA\xB2\xB3\xB4\xB5\xB6\xB7\xB8\xB9\xBA\xC2\xC3\xC4\xC5\xC6\xC7\xC8\xC9\xCA\xD2\xD3\xD4\xD5\xD6\xD7\xD8\xD9\xDA\xE1\xE2\xE3\xE4\xE5\xE6\xE7\xE8\xE9\xEA\xF1\xF2\xF3\xF4\xF5\xF6\xF7\xF8\xF9\xFA\xFF\xDA\x00\x08\x01\x01\x00\x00\x3F\x00\xFB\xFF\xD9" > avatar.jpg
    fi
    
    response=$(curl -s -X POST "$BASE_URL/users/avatar" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -F "avatar=@avatar.jpg")
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        avatar_url=$(parse_json "$response" ".avatarUrl")
        print_success "Avatar uploaded successfully"
        echo "Avatar URL: $avatar_url"
    else
        print_error "Failed to upload avatar"
    fi
    
    echo "Response: $response"
}

# 9. Logout
logout() {
    print_header "Logout"
    
    # Load tokens if available
    if [ -f .tokens ]; then
        source .tokens
    fi
    
    if [ -z "$ACCESS_TOKEN" ]; then
        print_error "No access token available."
        return 1
    fi
    
    response=$(curl -s -X POST "$BASE_URL/auth/logout" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "refreshToken": "'$REFRESH_TOKEN'"
        }')
    
    success=$(parse_json "$response" ".success")
    
    if [ "$success" = "true" ]; then
        print_success "Logged out successfully"
        
        # Clear saved tokens
        rm -f .tokens
    else
        print_error "Logout failed"
    fi
    
    echo "Response: $response"
}

# Test error scenarios
test_errors() {
    print_header "Test Error Scenarios"
    
    # 404 Error
    echo -e "\n${BLUE}Testing 404 Error:${NC}"
    curl -s -X GET "$BASE_URL/invalid-endpoint" | jq .
    
    # 401 Unauthorized
    echo -e "\n${BLUE}Testing 401 Unauthorized:${NC}"
    curl -s -X GET "$BASE_URL/users/profile" | jq .
    
    # 400 Validation Error
    echo -e "\n${BLUE}Testing 400 Validation Error:${NC}"
    curl -s -X POST "$BASE_URL/auth/register" \
        -H "Content-Type: application/json" \
        -d '{
            "username": "a",
            "email": "invalid-email",
            "password": "weak"
        }' | jq .
}

# Rate limit test
test_rate_limit() {
    print_header "Test Rate Limiting"
    
    echo "Making rapid requests to test rate limiting..."
    
    for i in {1..10}; do
        echo -n "Request $i: "
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/auth/login" \
            -H "Content-Type: application/json" \
            -d '{"identifier": "test@example.com", "password": "wrong"}')
        
        if [ "$response" = "429" ]; then
            print_error "Rate limited!"
            break
        else
            echo "Status: $response"
        fi
        
        sleep 0.1
    done
}

# Full workflow example
full_workflow() {
    print_header "Full Workflow Example"
    
    # 1. Health check
    health_check
    
    # 2. Register
    register_user
    
    # 3. Login
    login
    
    # 4. Get profile
    get_profile
    
    # 5. Update profile
    update_profile
    
    # 6. Upload avatar
    upload_avatar
    
    # 7. Change password
    change_password
    
    # 8. Refresh token
    refresh_token
    
    # 9. Logout
    logout
    
    # Cleanup
    rm -f .test_credentials .tokens avatar.jpg
}

# Interactive menu
show_menu() {
    echo -e "\n${BLUE}Stellar API cURL Examples${NC}"
    echo "=========================="
    echo "1. Health Check"
    echo "2. Register New User"
    echo "3. Login"
    echo "4. Get Profile"
    echo "5. Update Profile"
    echo "6. Change Password"
    echo "7. Refresh Token"
    echo "8. Upload Avatar"
    echo "9. Logout"
    echo "10. Test Errors"
    echo "11. Test Rate Limiting"
    echo "12. Run Full Workflow"
    echo "0. Exit"
    echo
}

# Main script
main() {
    while true; do
        show_menu
        read -p "Select an option: " choice
        
        case $choice in
            1) health_check ;;
            2) register_user ;;
            3) login ;;
            4) get_profile ;;
            5) update_profile ;;
            6) change_password ;;
            7) refresh_token ;;
            8) upload_avatar ;;
            9) logout ;;
            10) test_errors ;;
            11) test_rate_limit ;;
            12) full_workflow ;;
            0) 
                echo "Exiting..."
                rm -f .test_credentials .tokens avatar.jpg
                exit 0 
                ;;
            *) print_error "Invalid option" ;;
        esac
        
        read -p "Press Enter to continue..."
    done
}

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Warning: jq is not installed. JSON parsing will be limited."
    echo "Install jq for better output: apt-get install jq (Ubuntu) or brew install jq (Mac)"
fi

# Run main script
main