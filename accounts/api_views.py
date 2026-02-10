from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from django.contrib.auth import get_user_model
from django.db.models import Sum, Count, Q
from transactions.models import Transaction, Category, Budget
from .serializers import (
    UserSerializer, UserRegistrationSerializer, 
    UserProfileSerializer, ChangePasswordSerializer
)

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """API endpoint for user management"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_permissions(self):
        if self.action == 'create':
            return [AllowAny()]
        return super().get_permissions()
    
    def get_serializer_class(self):
        if self.action == 'create':
            return UserRegistrationSerializer
        elif self.action in ['update', 'partial_update', 'profile']:
            return UserProfileSerializer
        elif self.action == 'change_password':
            return ChangePasswordSerializer
        return UserSerializer
    
    def get_queryset(self):
        # Admins can see all users, regular users only see themselves
        if self.request.user.is_staff:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)
    
    @action(detail=False, methods=['get', 'put', 'patch'])
    def profile(self, request):
        """Get or update current user profile"""
        user = request.user
        
        if request.method == 'GET':
            serializer = UserProfileSerializer(user)
            return Response(serializer.data)
        
        elif request.method in ['PUT', 'PATCH']:
            serializer = UserProfileSerializer(
                user, 
                data=request.data, 
                partial=request.method == 'PATCH'
            )
            if serializer.is_valid():
                serializer.save()
                return Response(serializer.data)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'])
    def change_password(self, request):
        """Change user password"""
        user = request.user
        serializer = ChangePasswordSerializer(data=request.data)
        
        if serializer.is_valid():
            # Check old password
            if not user.check_password(serializer.validated_data['old_password']):
                return Response(
                    {'old_password': ['Wrong password.']},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Set new password
            user.set_password(serializer.validated_data['new_password'])
            user.save()
            
            return Response({'message': 'Password updated successfully.'})
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminUserManagementViewSet(viewsets.ReadOnlyModelViewSet):
    """Admin-only API endpoint for user management and monitoring"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def dashboard_stats(self, request):
        """Get admin dashboard statistics"""
        total_users = User.objects.count()
        active_users = User.objects.filter(is_active=True).count()
        staff_users = User.objects.filter(is_staff=True).count()
        
        # Recent registrations (last 30 days)
        from datetime import datetime, timedelta
        thirty_days_ago = datetime.now() - timedelta(days=30)
        recent_registrations = User.objects.filter(date_joined__gte=thirty_days_ago).count()
        
        # Total transactions across all users
        total_transactions = Transaction.objects.count()
        total_income = Transaction.objects.filter(type='income').aggregate(total=Sum('amount'))['total'] or 0
        total_expenses = Transaction.objects.filter(type='expense').aggregate(total=Sum('amount'))['total'] or 0
        
        # Total categories and budgets
        total_categories = Category.objects.count()
        total_budgets = Budget.objects.count()
        
        return Response({
            'total_users': total_users,
            'active_users': active_users,
            'staff_users': staff_users,
            'recent_registrations': recent_registrations,
            'total_transactions': total_transactions,
            'total_income': str(total_income),
            'total_expenses': str(total_expenses),
            'total_categories': total_categories,
            'total_budgets': total_budgets,
        })
    
    @action(detail=False, methods=['get'])
    def user_list_detailed(self, request):
        """Get detailed list of all users with their statistics"""
        users = User.objects.all().order_by('-date_joined')
        
        user_data = []
        for user in users:
            # Get user statistics
            transaction_count = Transaction.objects.filter(user=user).count()
            total_income = Transaction.objects.filter(user=user, type='income').aggregate(total=Sum('amount'))['total'] or 0
            total_expenses = Transaction.objects.filter(user=user, type='expense').aggregate(total=Sum('amount'))['total'] or 0
            category_count = Category.objects.filter(user=user).count()
            budget_count = Budget.objects.filter(user=user).count()
            
            user_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
                'phone_number': user.phone_number,
                'preferred_currency': user.preferred_currency,
                'statistics': {
                    'transaction_count': transaction_count,
                    'total_income': str(total_income),
                    'total_expenses': str(total_expenses),
                    'net_savings': str(total_income - total_expenses),
                    'category_count': category_count,
                    'budget_count': budget_count,
                }
            })
        
        return Response(user_data)
    
    @action(detail=True, methods=['get'])
    def user_details(self, request, pk=None):
        """Get detailed information about a specific user"""
        user = self.get_object()
        
        # Get user's recent transactions
        recent_transactions = Transaction.objects.filter(user=user).order_by('-date')[:10]
        transactions_data = [{
            'id': t.id,
            'description': t.description,
            'amount': str(t.amount),
            'type': t.type,
            'date': t.date,
            'category_name': t.category.name,
        } for t in recent_transactions]
        
        # Get user's categories
        categories = Category.objects.filter(user=user)
        categories_data = [{
            'id': c.id,
            'name': c.name,
            'type': c.type,
            'color': c.color,
        } for c in categories]
        
        # Get user's budgets
        budgets = Budget.objects.filter(user=user)
        budgets_data = [{
            'id': b.id,
            'category_name': b.category.name,
            'amount': str(b.amount),
            'period': b.period,
            'start_date': b.start_date,
        } for b in budgets]
        
        # Calculate statistics
        total_income = Transaction.objects.filter(user=user, type='income').aggregate(total=Sum('amount'))['total'] or 0
        total_expenses = Transaction.objects.filter(user=user, type='expense').aggregate(total=Sum('amount'))['total'] or 0
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'full_name': user.full_name,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone_number': user.phone_number,
                'preferred_currency': user.preferred_currency,
                'date_of_birth': user.date_of_birth,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
                'email_notifications': user.email_notifications,
                'budget_alert_notifications': user.budget_alert_notifications,
            },
            'statistics': {
                'total_income': str(total_income),
                'total_expenses': str(total_expenses),
                'net_savings': str(total_income - total_expenses),
                'transaction_count': Transaction.objects.filter(user=user).count(),
                'category_count': categories.count(),
                'budget_count': budgets.count(),
            },
            'recent_transactions': transactions_data,
            'categories': categories_data,
            'budgets': budgets_data,
        })
    
    @action(detail=True, methods=['post'])
    def toggle_active(self, request, pk=None):
        """Toggle user active status"""
        user = self.get_object()
        user.is_active = not user.is_active
        user.save()
        return Response({
            'message': f"User {'activated' if user.is_active else 'deactivated'} successfully",
            'is_active': user.is_active
        })
    
    @action(detail=True, methods=['delete'])
    def delete_user(self, request, pk=None):
        """Delete a user and all their data"""
        user = self.get_object()
        
        # Prevent deleting yourself
        if user.id == request.user.id:
            return Response(
                {'error': 'You cannot delete your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        username = user.username
        user.delete()
        return Response({
            'message': f"User '{username}' and all associated data deleted successfully"
        })
