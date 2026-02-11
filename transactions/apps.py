from django.apps import AppConfig

class TransactionsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'transactions'

    def ready(self):
        print("Transactions app ready() called ✅")
        try:
            import transactions.signals
            print("signals.py imported successfully ✅")
        except Exception as e:
            print("❌ ERROR IMPORTING SIGNALS:", e)
