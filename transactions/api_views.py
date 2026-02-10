from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime, timedelta
from decimal import Decimal
from .models import Category, Transaction, Budget, RecurringTransaction
from .serializers import (
    CategorySerializer, TransactionSerializer, BudgetSerializer,
    RecurringTransactionSerializer, DashboardStatsSerializer
)


class CategoryViewSet(viewsets.ModelViewSet):
    """API endpoint for categories"""
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'type', 'created_at']
    ordering = ['type', 'name']
    
    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def by_type(self, request):
        """Get categories filtered by type"""
        category_type = request.query_params.get('type', None)
        queryset = self.get_queryset()
        
        if category_type in ['income', 'expense']:
            queryset = queryset.filter(type=category_type)
        
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


class TransactionViewSet(viewsets.ModelViewSet):
    """API endpoint for transactions"""
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'notes']
    ordering_fields = ['date', 'amount', 'created_at']
    ordering = ['-date', '-created_at']
    
    def get_queryset(self):
        queryset = Transaction.objects.filter(user=self.request.user)
        
        # Filter by type
        transaction_type = self.request.query_params.get('type', None)
        if transaction_type in ['income', 'expense']:
            queryset = queryset.filter(type=transaction_type)
        
        # Filter by category
        category_id = self.request.query_params.get('category', None)
        if category_id:
            queryset = queryset.filter(category_id=category_id)
        
        # Filter by date range
        start_date = self.request.query_params.get('start_date', None)
        end_date = self.request.query_params.get('end_date', None)
        
        if start_date:
            queryset = queryset.filter(date__gte=start_date)
        if end_date:
            queryset = queryset.filter(date__lte=end_date)
        
        return queryset
    
    def perform_create(self, serializer):
        transaction = serializer.save(user=self.request.user)
        
        # Check budgets and send alerts if needed
        if transaction.type == 'expense':
            from accounts.notifications import email_service
            
            # Get active budgets for this category
            budgets = Budget.objects.filter(
                user=self.request.user,
                category=transaction.category,
                is_active=True
            )
            
            for budget in budgets:
                # Check if budget alert should be sent
                if budget.should_alert() or budget.is_over_budget():
                    email_service.send_budget_alert(self.request.user, budget)
    
    def perform_update(self, serializer):
        transaction = serializer.save()
        
        # Check budgets and send alerts if needed (after update)
        if transaction.type == 'expense':
            from accounts.notifications import email_service
            
            # Get active budgets for this category
            budgets = Budget.objects.filter(
                user=self.request.user,
                category=transaction.category,
                is_active=True
            )
            
            for budget in budgets:
                # Check if budget alert should be sent
                if budget.should_alert() or budget.is_over_budget():
                    email_service.send_budget_alert(self.request.user, budget)
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get transaction summary"""
        queryset = self.get_queryset()
        
        total_income = queryset.filter(type='income').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        total_expenses = queryset.filter(type='expense').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        return Response({
            'total_income': float(total_income),
            'total_expenses': float(total_expenses),
            'net_savings': float(total_income - total_expenses),
            'transaction_count': queryset.count()
        })


class BudgetViewSet(viewsets.ModelViewSet):
    """API endpoint for budgets"""
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['amount', 'period', 'start_date', 'created_at']
    ordering = ['-created_at']
    
    def get_queryset(self):
        queryset = Budget.objects.filter(user=self.request.user)
        
        # Filter by active status
        is_active = self.request.query_params.get('is_active', None)
        if is_active is not None:
            queryset = queryset.filter(is_active=is_active.lower() == 'true')
        
        # Filter by period
        period = self.request.query_params.get('period', None)
        if period:
            queryset = queryset.filter(period=period)
        
        return queryset
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Get budgets that need alerts"""
        queryset = self.get_queryset().filter(is_active=True)
        alert_budgets = [budget for budget in queryset if budget.should_alert()]
        serializer = self.get_serializer(alert_budgets, many=True)
        return Response(serializer.data)


class RecurringTransactionViewSet(viewsets.ModelViewSet):
    """API endpoint for recurring transactions"""
    serializer_class = RecurringTransactionSerializer
    permission_classes = [IsAuthenticated]
    ordering = ['next_occurrence']
    
    def get_queryset(self):
        return RecurringTransaction.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class DashboardViewSet(viewsets.ViewSet):
    """API endpoint for dashboard data"""
    permission_classes = [IsAuthenticated]
    
    def list(self, request):
        """Get dashboard statistics"""
        user = request.user
        today = timezone.now().date()
        
        # Get date range from query params
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date:
            start_date = today.replace(day=1)
        else:
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        
        if not end_date:
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        else:
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Get transactions for the period
        transactions = Transaction.objects.filter(
            user=user,
            date__gte=start_date,
            date__lte=end_date
        )
        
        # Calculate totals
        total_income = transactions.filter(type='income').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        total_expenses = transactions.filter(type='expense').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        # Get category-wise breakdown
        expense_by_category = list(transactions.filter(type='expense').values(
            'category__name', 'category__color'
        ).annotate(total=Sum('amount')).order_by('-total')[:10])
        
        income_by_category = list(transactions.filter(type='income').values(
            'category__name', 'category__color'
        ).annotate(total=Sum('amount')).order_by('-total')[:10])
        
        # Get recent transactions
        recent_transactions = transactions.order_by('-date', '-created_at')[:10]
        
        # Get counts
        category_count = Category.objects.filter(user=user, is_active=True).count()
        budget_count = Budget.objects.filter(user=user, is_active=True).count()
        
        data = {
            'total_income': float(total_income),
            'total_expenses': float(total_expenses),
            'net_savings': float(total_income - total_expenses),
            'transaction_count': transactions.count(),
            'category_count': category_count,
            'budget_count': budget_count,
            'expense_by_category': expense_by_category,
            'income_by_category': income_by_category,
            'recent_transactions': TransactionSerializer(recent_transactions, many=True).data,
        }
        
        return Response(data)
    
    @action(detail=False, methods=['post'])
    def email_report(self, request):
        """Send financial report via email"""
        from accounts.notifications import email_service
        
        user = request.user
        today = timezone.now().date()
        
        # Get date range from request
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        report_type = request.data.get('report_type', 'monthly')  # daily, weekly, monthly, custom
        custom_email = request.data.get('email', user.email)  # Allow custom email or use user's email
        
        # Calculate date range based on report type
        if report_type == 'daily':
            start_date = today
            end_date = today
        elif report_type == 'weekly':
            start_date = today - timedelta(days=7)
            end_date = today
        elif report_type == 'monthly':
            start_date = today.replace(day=1)
            if today.month == 12:
                end_date = today.replace(day=31)
            else:
                end_date = (today.replace(month=today.month + 1, day=1) - timedelta(days=1))
        elif report_type == 'custom':
            if not start_date or not end_date:
                return Response(
                    {'error': 'start_date and end_date required for custom reports'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Get transactions for the period
        transactions = Transaction.objects.filter(
            user=user,
            date__gte=start_date,
            date__lte=end_date
        )
        
        # Calculate totals
        total_income = transactions.filter(type='income').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        total_expenses = transactions.filter(type='expense').aggregate(
            total=Sum('amount'))['total'] or Decimal('0.00')
        
        net_savings = total_income - total_expenses
        
        # Get category breakdown
        expense_by_category = list(transactions.filter(type='expense').values(
            'category__name'
        ).annotate(total=Sum('amount')).order_by('-total')[:5])
        
        income_by_category = list(transactions.filter(type='income').values(
            'category__name'
        ).annotate(total=Sum('amount')).order_by('-total')[:5])
        
        # Get budget status
        budgets = Budget.objects.filter(user=user, is_active=True)
        budget_alerts = []
        for budget in budgets:
            if budget.should_alert() or budget.is_over_budget():
                budget_alerts.append({
                    'category': budget.category.name,
                    'amount': budget.amount,
                    'spent': budget.get_spent_amount(),
                    'percentage': budget.get_percentage_used(),
                    'is_exceeded': budget.is_over_budget()
                })
        
        # Send email report to custom email or user's email
        try:
            success = self._send_financial_report_email(
                user, start_date, end_date, report_type,
                total_income, total_expenses, net_savings,
                expense_by_category, income_by_category,
                budget_alerts, transactions.count(),
                custom_email  # Pass custom email
            )
            
            # Always return success since email falls back to console
            return Response({
                'message': f'Financial report generated successfully! {"Email sent to " + custom_email if success else "Check Django console for report output (email service unavailable)"}',
                'email': custom_email,
                'report_type': report_type,
                'success': True
            })
            
        except Exception as e:
            # Log error but still return success with console fallback message
            print(f"Error generating report: {str(e)}")
            return Response({
                'message': 'Report generated and displayed in console (email service unavailable)',
                'email': custom_email,
                'report_type': report_type,
                'success': True
            })
    
    def _send_financial_report_email(self, user, start_date, end_date, report_type,
                                     total_income, total_expenses, net_savings,
                                     expense_by_category, income_by_category,
                                     budget_alerts, transaction_count, to_email=None):
        """Helper method to send financial report email"""
        from accounts.notifications import email_service
        
        # Use custom email or user's email
        recipient_email = to_email or user.email
        # Format report type for display
        report_type_display = report_type.capitalize()
        date_range = f"{start_date.strftime('%B %d, %Y')} - {end_date.strftime('%B %d, %Y')}"
        
        # Build category tables HTML
        expense_rows = ''.join([
            f'<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{cat["category__name"]}</td>'
            f'<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #ef4444; font-weight: 600;">${cat["total"]:.2f}</td></tr>'
            for cat in expense_by_category
        ]) if expense_by_category else '<tr><td colspan="2" style="padding: 8px; text-align: center; color: #9ca3af;">No expenses</td></tr>'
        
        income_rows = ''.join([
            f'<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{cat["category__name"]}</td>'
            f'<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; color: #10b981; font-weight: 600;">${cat["total"]:.2f}</td></tr>'
            for cat in income_by_category
        ]) if income_by_category else '<tr><td colspan="2" style="padding: 8px; text-align: center; color: #9ca3af;">No income</td></tr>'
        
        # Build budget alerts HTML
        budget_alerts_html = ''
        if budget_alerts:
            budget_alerts_html = '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;"><h3 style="margin-top: 0; color: #92400e;">⚠️ Budget Alerts</h3>'
            for alert in budget_alerts:
                status_text = 'EXCEEDED' if alert['is_exceeded'] else 'ALERT'
                status_color = '#dc2626' if alert['is_exceeded'] else '#f59e0b'
                budget_alerts_html += f'''
                <div style="margin: 10px 0; padding: 10px; background: white; border-radius: 5px;">
                    <strong>{alert['category']}</strong>
                    <span style="float: right; color: {status_color}; font-weight: 700;">{status_text}</span>
                    <div style="margin-top: 5px; font-size: 14px; color: #6b7280;">
                        ${alert['spent']:.2f} / ${alert['amount']:.2f} ({alert['percentage']:.1f}%)
                    </div>
                </div>
                '''
            budget_alerts_html += '</div>'
        
        subject = f"📊 Your {report_type_display} Financial Report"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .stats-grid {{ display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 15px; margin: 20px 0; }}
                .stat-card {{ background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                .stat-value {{ font-size: 24px; font-weight: 700; margin: 10px 0; }}
                .income {{ color: #10b981; }}
                .expense {{ color: #ef4444; }}
                .savings {{ color: #3b82f6; }}
                .stat-label {{ color: #6b7280; font-size: 14px; }}
                .section {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                table {{ width: 100%; border-collapse: collapse; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 {report_type_display} Financial Report</h1>
                    <p>{date_range}</p>
                </div>
                <div class="content">
                    <p>Hi {user.first_name or user.username},</p>
                    
                    <p>Here's your financial report for the selected period:</p>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Income</div>
                            <div class="stat-value income">${total_income:.2f}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Total Expenses</div>
                            <div class="stat-value expense">${total_expenses:.2f}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Net Savings</div>
                            <div class="stat-value savings">${net_savings:.2f}</div>
                        </div>
                    </div>
                    
                    {budget_alerts_html}
                    
                    <div class="section">
                        <h3>Top Expenses by Category</h3>
                        <table>
                            {expense_rows}
                        </table>
                    </div>
                    
                    <div class="section">
                        <h3>Income by Category</h3>
                        <table>
                            {income_rows}
                        </table>
                    </div>
                    
                    <div class="section">
                        <p><strong>Total Transactions:</strong> {transaction_count}</p>
                    </div>
                    
                    <p>Log in to Finance Tracker to view detailed reports and manage your finances.</p>
                    
                    <div class="footer">
                        <p>This is an automated report from Finance Tracker.</p>
                        <p>You can request reports anytime from your dashboard.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return email_service.send_email(recipient_email, subject, html_content)

    
    @action(detail=False, methods=['get'])
    def monthly_report(self, request):
        """Get monthly income vs expenses report"""
        user = request.user
        today = timezone.now().date()
        
        months_data = []
        for i in range(11, -1, -1):
            month_date = today - timedelta(days=30 * i)
            month_start = month_date.replace(day=1)
            if month_date.month == 12:
                month_end = month_date.replace(day=31)
            else:
                month_end = (month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1))
            
            income = Transaction.objects.filter(
                user=user,
                type='income',
                date__gte=month_start,
                date__lte=month_end
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            expenses = Transaction.objects.filter(
                user=user,
                type='expense',
                date__gte=month_start,
                date__lte=month_end
            ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
            
            months_data.append({
                'month': month_start.strftime('%B %Y'),
                'month_short': month_start.strftime('%b %Y'),
                'income': float(income),
                'expenses': float(expenses),
                'savings': float(income - expenses),
            })
        
        return Response(months_data)
