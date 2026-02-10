from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator
from decimal import Decimal


class Category(models.Model):
    """Model for income and expense categories"""
    CATEGORY_TYPES = (
        ('income', 'Income'),
        ('expense', 'Expense'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='categories')
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=10, choices=CATEGORY_TYPES)
    description = models.TextField(blank=True, null=True)
    icon = models.CharField(max_length=50, blank=True, null=True)
    color = models.CharField(max_length=7, default='#000000')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'categories'
        verbose_name = 'Category'
        verbose_name_plural = 'Categories'
        unique_together = ['user', 'name', 'type']
        ordering = ['type', 'name']
    
    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Transaction(models.Model):
    """Model for financial transactions (income and expenses)"""
    TRANSACTION_TYPES = (
        ('income', 'Income'),
        ('expense', 'Expense'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='transactions')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    currency = models.CharField(max_length=3, default='USD')
    type = models.CharField(max_length=10, choices=TRANSACTION_TYPES)
    description = models.TextField()
    date = models.DateField()
    receipt = models.FileField(upload_to='receipts/%Y/%m/', blank=True, null=True)
    is_recurring = models.BooleanField(default=False)
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'transactions'
        verbose_name = 'Transaction'
        verbose_name_plural = 'Transactions'
        ordering = ['-date', '-created_at']
        indexes = [
            models.Index(fields=['user', 'date']),
            models.Index(fields=['user', 'type']),
            models.Index(fields=['category']),
        ]
    
    def __str__(self):
        return f"{self.get_type_display()} - {self.amount} {self.currency} on {self.date}"
    
    def save(self, *args, **kwargs):
        # Ensure type matches category type
        if self.category:
            self.type = self.category.type
        super().save(*args, **kwargs)


class Budget(models.Model):
    """Model for budget goals"""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='budgets')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='budgets')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    currency = models.CharField(max_length=3, default='USD')
    period = models.CharField(max_length=20, choices=[
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    ], default='monthly')
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    alert_threshold = models.IntegerField(default=80, help_text='Alert when spending reaches this percentage')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'budgets'
        verbose_name = 'Budget'
        verbose_name_plural = 'Budgets'
        ordering = ['-created_at']
        unique_together = ['user', 'category', 'period', 'start_date']
    
    def __str__(self):
        return f"{self.category.name} - {self.amount} {self.currency} ({self.period})"
    
    def get_spent_amount(self):
        """Calculate total spent in this budget period"""
        from django.db.models import Sum
        from datetime import timedelta
        from dateutil.relativedelta import relativedelta
        
        # Calculate end date based on period if not set
        if self.end_date:
            end_date = self.end_date
        else:
            if self.period == 'daily':
                end_date = self.start_date
            elif self.period == 'weekly':
                end_date = self.start_date + timedelta(days=7)
            elif self.period == 'monthly':
                end_date = self.start_date + relativedelta(months=1) - timedelta(days=1)
            elif self.period == 'yearly':
                end_date = self.start_date + relativedelta(years=1) - timedelta(days=1)
            else:
                end_date = self.start_date
        
        spent = self.category.transactions.filter(
            user=self.user,
            date__gte=self.start_date,
            date__lte=end_date
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return spent
    
    def get_remaining_amount(self):
        """Calculate remaining budget"""
        return self.amount - self.get_spent_amount()
    
    def get_percentage_used(self):
        """Calculate percentage of budget used"""
        spent = self.get_spent_amount()
        if self.amount > 0:
            return (spent / self.amount) * 100
        return 0
    
    def is_over_budget(self):
        """Check if budget is exceeded"""
        return self.get_spent_amount() > self.amount
    
    def should_alert(self):
        """Check if alert threshold is reached"""
        return self.get_percentage_used() >= self.alert_threshold


class RecurringTransaction(models.Model):
    """Model for recurring transactions"""
    FREQUENCY_CHOICES = (
        ('daily', 'Daily'),
        ('weekly', 'Weekly'),
        ('monthly', 'Monthly'),
        ('yearly', 'Yearly'),
    )
    
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recurring_transactions')
    category = models.ForeignKey(Category, on_delete=models.CASCADE, related_name='recurring_transactions')
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(Decimal('0.01'))])
    currency = models.CharField(max_length=3, default='USD')
    type = models.CharField(max_length=10, choices=Transaction.TRANSACTION_TYPES)
    description = models.TextField()
    frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    start_date = models.DateField()
    end_date = models.DateField(blank=True, null=True)
    next_occurrence = models.DateField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'recurring_transactions'
        verbose_name = 'Recurring Transaction'
        verbose_name_plural = 'Recurring Transactions'
        ordering = ['next_occurrence']
    
    def __str__(self):
        return f"{self.description} - {self.amount} {self.currency} ({self.frequency})"
