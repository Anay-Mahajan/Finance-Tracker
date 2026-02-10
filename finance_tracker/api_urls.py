from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework.authtoken.views import obtain_auth_token
from transactions.api_views import (
    CategoryViewSet, TransactionViewSet, BudgetViewSet,
    RecurringTransactionViewSet, DashboardViewSet
)
from accounts.api_views import UserViewSet, AdminUserManagementViewSet
from accounts.oauth_views import google_login, google_oauth_config

# Create router
router = DefaultRouter()

# Register viewsets
router.register(r'categories', CategoryViewSet, basename='category')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'budgets', BudgetViewSet, basename='budget')
router.register(r'recurring-transactions', RecurringTransactionViewSet, basename='recurring-transaction')
router.register(r'dashboard', DashboardViewSet, basename='dashboard')
router.register(r'users', UserViewSet, basename='user')
router.register(r'admin/users', AdminUserManagementViewSet, basename='admin-users')

urlpatterns = [
    path('', include(router.urls)),
    path('auth/login/', obtain_auth_token, name='api_token_auth'),
    path('auth/google/', google_login, name='google_login'),
    path('auth/google/config/', google_oauth_config, name='google_oauth_config'),
    path('auth/', include('rest_framework.urls')),  # Browsable API login/logout
]
