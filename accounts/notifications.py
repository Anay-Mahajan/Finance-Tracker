"""
Email Notification Service
Supports both Gmail SMTP and SendGrid via Django's email backend
"""

from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils.html import strip_tags
import logging

logger = logging.getLogger(__name__)


class EmailNotificationService:
    """Service for sending email notifications using Django's email backend"""
    
    def __init__(self):
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@financetracker.com')
        self.backend = getattr(settings, 'EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
        self.enabled = 'console' not in self.backend.lower()
        
        if not self.enabled:
            logger.info("Email backend is console mode. Emails will print to console.")
    
    def send_email(self, to_email, subject, html_content, plain_content=None):
        """Send an email using Django's email backend (Gmail SMTP or SendGrid)"""
        try:
            # Create plain text version if not provided
            if not plain_content:
                plain_content = strip_tags(html_content)
            
            # Create email message
            email = EmailMultiAlternatives(
                subject=subject,
                body=plain_content,
                from_email=self.from_email,
                to=[to_email]
            )
            
            # Attach HTML version
            email.attach_alternative(html_content, "text/html")
            
            # Send email
            email.send(fail_silently=False)
            
            logger.info(f"Email sent successfully: {subject} to {to_email}")
            print(f"\n{'='*60}")
            print(f"✅ EMAIL SENT: {subject}")
            print(f"To: {to_email}")
            print(f"From: {self.from_email}")
            print(f"Backend: {self.backend}")
            print(f"{'='*60}\n")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email: {subject} to {to_email}. Error: {str(e)}")
            # Fallback to console output for development
            print(f"\n{'='*60}")
            print(f"❌ EMAIL FAILED: {subject}")
            print(f"To: {to_email}")
            print(f"Error: {str(e)}")
            print(f"{'='*60}\n")
            print(f"HTML Content Preview:")
            print(plain_content[:500])
            print(f"{'='*60}\n")
            return False
    
    def send_budget_alert(self, user, budget):
        """Send budget alert notification"""
        if not user.budget_alert_notifications:
            return False
        
        percentage = budget.get_percentage_used()
        is_exceeded = budget.is_over_budget()
        
        subject = f"Budget Alert: {budget.category.name}"
        
        if is_exceeded:
            subject = f"⚠️ Budget Exceeded: {budget.category.name}"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .alert-box {{ background: {'#fee2e2' if is_exceeded else '#fef3c7'}; border-left: 4px solid {'#dc2626' if is_exceeded else '#f59e0b'}; padding: 15px; margin: 20px 0; border-radius: 5px; }}
                .stats {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .stat-row {{ display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
                .stat-label {{ font-weight: 600; color: #6b7280; }}
                .stat-value {{ font-weight: 700; color: {'#dc2626' if is_exceeded else '#f59e0b'}; }}
                .progress-bar {{ background: #e5e7eb; height: 20px; border-radius: 10px; overflow: hidden; margin: 10px 0; }}
                .progress-fill {{ background: {'linear-gradient(90deg, #dc2626, #ef4444)' if is_exceeded else 'linear-gradient(90deg, #f59e0b, #fbbf24)'}; height: 100%; width: {min(percentage, 100)}%; transition: width 0.3s; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>{'⚠️ Budget Exceeded!' if is_exceeded else '📊 Budget Alert'}</h1>
                    <p>Finance Tracker Notification</p>
                </div>
                <div class="content">
                    <p>Hi {user.first_name or user.username},</p>
                    
                    <div class="alert-box">
                        <strong>{'Your budget has been exceeded!' if is_exceeded else 'You have reached your budget alert threshold!'}</strong>
                    </div>
                    
                    <div class="stats">
                        <h3>Budget Details: {budget.category.name}</h3>
                        <div class="stat-row">
                            <span class="stat-label">Budget Amount:</span>
                            <span class="stat-value">{budget.currency} {budget.amount}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Spent Amount:</span>
                            <span class="stat-value">{budget.currency} {budget.get_spent_amount()}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Remaining:</span>
                            <span class="stat-value">{budget.currency} {budget.get_remaining_amount()}</span>
                        </div>
                        <div class="stat-row">
                            <span class="stat-label">Usage:</span>
                            <span class="stat-value">{percentage:.1f}%</span>
                        </div>
                        
                        <div class="progress-bar">
                            <div class="progress-fill"></div>
                        </div>
                    </div>
                    
                    <p>{'Consider reviewing your spending in this category to stay within budget.' if is_exceeded else 'You are approaching your budget limit. Monitor your spending carefully.'}</p>
                    
                    <p>You can view detailed reports and adjust your budget in the Finance Tracker app.</p>
                    
                    <div class="footer">
                        <p>This is an automated notification from Finance Tracker.</p>
                        <p>You can manage your notification preferences in your account settings.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(user.email, subject, html_content)
    
    def send_weekly_summary(self, user, stats):
        """Send weekly financial summary"""
        if not user.email_notifications:
            return False
        
        subject = f"📊 Your Weekly Financial Summary"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .stats-grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }}
                .stat-card {{ background: white; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                .stat-value {{ font-size: 28px; font-weight: 700; margin: 10px 0; }}
                .income {{ color: #10b981; }}
                .expense {{ color: #ef4444; }}
                .savings {{ color: #3b82f6; }}
                .stat-label {{ color: #6b7280; font-size: 14px; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📊 Weekly Financial Summary</h1>
                    <p>Your financial overview for the past week</p>
                </div>
                <div class="content">
                    <p>Hi {user.first_name or user.username},</p>
                    
                    <p>Here's your financial summary for the past week:</p>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-label">Total Income</div>
                            <div class="stat-value income">${stats.get('income', 0)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Total Expenses</div>
                            <div class="stat-value expense">${stats.get('expenses', 0)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Net Savings</div>
                            <div class="stat-value savings">${stats.get('savings', 0)}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-label">Transactions</div>
                            <div class="stat-value">{stats.get('transaction_count', 0)}</div>
                        </div>
                    </div>
                    
                    <p>Keep up the good work tracking your finances!</p>
                    
                    <div class="footer">
                        <p>This is an automated weekly summary from Finance Tracker.</p>
                        <p>You can manage your notification preferences in your account settings.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(user.email, subject, html_content)
    
    def send_welcome_email(self, user):
        """Send welcome email to new users"""
        if not user.email_notifications:
            return False
        
        subject = "Welcome to Finance Tracker! 🎉"
        
        html_content = f"""
        <html>
        <head>
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }}
                .feature-list {{ background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }}
                .feature-item {{ padding: 10px 0; border-bottom: 1px solid #e5e7eb; }}
                .footer {{ text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 Welcome to Finance Tracker!</h1>
                    <p>Start managing your finances like a pro</p>
                </div>
                <div class="content">
                    <p>Hi {user.first_name or user.username},</p>
                    
                    <p>Welcome to Finance Tracker! We're excited to help you take control of your financial future.</p>
                    
                    <div class="feature-list">
                        <h3>What you can do:</h3>
                        <div class="feature-item">📊 Track income and expenses</div>
                        <div class="feature-item">🏷️ Organize transactions by categories</div>
                        <div class="feature-item">💰 Set and monitor budgets</div>
                        <div class="feature-item">📈 View detailed financial reports</div>
                        <div class="feature-item">🧾 Upload receipts for transactions</div>
                        <div class="feature-item">💱 Support for multiple currencies</div>
                    </div>
                    
                    <p>Get started by adding your first transaction or setting up your budget goals!</p>
                    
                    <div class="footer">
                        <p>Thank you for choosing Finance Tracker!</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self.send_email(user.email, subject, html_content)


# Create a singleton instance
email_service = EmailNotificationService()
