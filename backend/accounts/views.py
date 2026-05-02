from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db.models import Q
from .serializers import RegisterSerializer, UserSerializer
from tickets.models import Agent

class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    
    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Determine role
        if user.is_superuser:
            role = 'super_admin'
        else:
            try:
                agent = Agent.objects.get(user=user)
                role = 'agent'
            except Agent.DoesNotExist:
                role = 'student'
        
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': role
            },
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'message': 'Registration successful'
        }, status=201)

class LoginView(generics.GenericAPIView):
    permission_classes = [permissions.AllowAny]
    
    def post(self, request):
        username_or_email = request.data.get('username')
        password = request.data.get('password')
        
        if not username_or_email or not password:
            return Response({'error': 'Username/email and password required'}, status=400)
        
        try:
            if '@' in username_or_email:
                user = User.objects.get(email=username_or_email)
            else:
                user = User.objects.get(username=username_or_email)
        except User.DoesNotExist:
            return Response({'error': 'Invalid credentials'}, status=401)
        
        if not user.check_password(password):
            return Response({'error': 'Invalid credentials'}, status=401)
        
        refresh = RefreshToken.for_user(user)
        
        # Determine role - check for super admin first
        if user.is_superuser:
            role = 'super_admin'
        else:
            try:
                agent = Agent.objects.get(user=user)
                role = 'agent'
            except Agent.DoesNotExist:
                role = 'student'
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': role  # Make sure this is included
            },
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })

class LogoutView(generics.GenericAPIView):
    permission_classes = [permissions.IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'message': 'Logged out successfully'})
        except Exception:
            return Response({'error': 'Invalid token'}, status=400)

class UserView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = UserSerializer
    
    def get_object(self):
        return self.request.user