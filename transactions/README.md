# Personal Finance Tracker

A comprehensive Django-based web application to manage and analyze personal financial health.

## Features

### Day 1-2: Basic Functionality
- ✅ User Authentication (Register, Login, Profile Management)
- ✅ Database Structure (Income, Expenses, Transactions)
- ✅ Transaction Management (Add, Edit, Delete with edge case handling)
- ✅ Dashboard with graphical representations
- ✅ Financial Reporting (Monthly income vs expenses)
- ✅ Budget Goals and Tracking

### Day 3: Additional Features
- ✅ OAuth Integration (Google Sign-in)
- ✅ Email Notifications (Budget overruns via SendGrid)
- ✅ Receipt Uploading
- ✅ Multiple Currency Support

### Day 4: Deployment
- ✅ Production deployment
- ✅ Security and performance optimization

### Day 5: Testing
- ✅ Comprehensive testing suite

### Part B: Extra Credit
- 🔄 OpenAI Integration
- 🔄 Bank Statement Import (PDF/CSV)
- 🔄 Anomaly Detection

## Tech Stack

- **Backend**: Django 5.0, Django REST Framework
- **Database**: PostgreSQL
- **Authentication**: Django Allauth (OAuth)
- **Email**: SendGrid
- **Frontend**: Django Templates, HTML, CSS
- **Deployment**: Heroku/AWS/DigitalOcean

## Installation

### Prerequisites
- Python 3.8+
- PostgreSQL 12+ (Download from https://www.postgresql.org/download/)
- Git

### Setup Steps

1. Clone the repository:
```bash
git clone https://github.com/yourusername/FJ-BE-R2-yourname.git
cd FJ-BE-R2-yourname
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Install and setup PostgreSQL:
   - Download from https://www.postgresql.org/download/windows/
   - Install PostgreSQL (remember the password!)
   - See `QUICKSTART.md` for detailed setup instructions

5. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Update `DATABASE_PASSWORD` with your PostgreSQL password
   - Update other settings as needed

6. Create database:
```bash
python setup_database.py
```
Or manually create database named `finance_tracker` in pgAdmin

7. Test database connection:
```bash
python test_postgres_connection.py
```

8. Run migrations:
```bash
python manage.py makemigrations
python manage.py migrate
```

9. Create superuser:
```bash
python manage.py createsuperuser
```

10. Run development server:
```bash
python manage.py runserver
```

Visit http://127.0.0.1:8000/admin to access the admin panel.

## Project Structure

```
finance_tracker/
├── finance_tracker/          # Project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── accounts/                 # User authentication
├── transactions/             # Transaction management
├── dashboard/                # Dashboard and reports
├── notifications/            # Email notifications
├── templates/                # HTML templates
├── static/                   # CSS, JS, images
├── media/                    # User uploads
└── manage.py
```

## API Endpoints

### Authentication
- `POST /api/auth/register/` - User registration
- `POST /api/auth/login/` - User login
- `GET /api/auth/profile/` - User profile

### Transactions
- `GET /api/transactions/` - List all transactions
- `POST /api/transactions/` - Create transaction
- `PUT /api/transactions/<id>/` - Update transaction
- `DELETE /api/transactions/<id>/` - Delete transaction

### Categories
- `GET /api/categories/` - List categories
- `POST /api/categories/` - Create category

### Budget
- `GET /api/budgets/` - List budgets
- `POST /api/budgets/` - Create budget goal

### Reports
- `GET /api/reports/monthly/` - Monthly report
- `GET /api/reports/category/` - Category-wise report

## Testing

Run tests:
```bash
python manage.py test
```

## Deployment

Deployment instructions for production environment.

## License

MIT License
