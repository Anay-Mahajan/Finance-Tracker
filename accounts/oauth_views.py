"""
OAuth Authentication Views
"""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.authtoken.models import Token
from django.contrib.auth import get_user_model
from allauth.socialaccount.models import SocialAccount
from google.oauth2 import id_token
from google.auth.transport import requests
from django.conf import settings
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_login(request):
    """
    Handle Google OAuth login
    Expects: { "token": "google_id_token" }
    Returns: { "token": "drf_auth_token", "user": {...} }
    """
    google_token = request.data.get('token')
    
    if not google_token:
        logger.error("Google token not provided in request")
        return Response(
            {'error': 'Google token is required'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    try:
        # Verify the Google token
        client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
        
        if not client_id:
            logger.error("Google OAuth client_id not configured")
            return Response(
                {'error': 'Google OAuth not configured'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        
        logger.info(f"Verifying Google token with client_id: {client_id[:20]}...")
        
        idinfo = id_token.verify_oauth2_token(
            google_token,
            requests.Request(),
            client_id
        )
        
        logger.info(f"Token verified successfully. User info: {idinfo.get('email')}")
        
        # Get user info from Google
        email = idinfo.get('email')
        google_id = idinfo.get('sub')
        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')
        picture = idinfo.get('picture', '')
        
        if not email:
            logger.error("Email not provided by Google in token")
            return Response(
                {'error': 'Email not provided by Google'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if user exists with this email
        user = None
        is_new_user = False
        try:
            user = User.objects.get(email=email)
            logger.info(f"Existing user found: {user.username}")
        except User.DoesNotExist:
            # Create new user
            username = email.split('@')[0]
            
            # Ensure username is unique
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1
            
            logger.info(f"Creating new user: {username}")
            
            user = User.objects.create_user(
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name
            )
            is_new_user = True
            
            # Send welcome email
            from accounts.notifications import email_service
            email_service.send_welcome_email(user)
            
            logger.info(f"New user created via Google OAuth: {user.username}")
        
        # Create or get social account
        social_account, created = SocialAccount.objects.get_or_create(
            user=user,
            provider='google',
            defaults={'uid': google_id}
        )
        
        if created:
            logger.info(f"Social account created for user: {user.username}")
        
        # Get or create auth token
        token, _ = Token.objects.get_or_create(user=user)
        
        # Return user data and token
        from accounts.serializers import UserSerializer
        user_data = UserSerializer(user).data
        
        logger.info(f"Google OAuth successful for user: {user.username}")
        
        return Response({
            'token': token.key,
            'user': user_data,
            'is_new_user': is_new_user
        })
        
    except ValueError as e:
        logger.error(f"Google token verification failed: {str(e)}")
        return Response(
            {'error': f'Invalid Google token: {str(e)}'},
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        logger.error(f"Google OAuth error: {str(e)}", exc_info=True)
        return Response(
            {'error': f'Authentication failed: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def google_oauth_config(request):
    """
    Return Google OAuth configuration for frontend
    """
    client_id = settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id']
    
    return Response({
        'client_id': client_id,
        'enabled': bool(client_id)
    })
