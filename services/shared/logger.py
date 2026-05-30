import logging
import sys
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """
    Formatador para transformar logs em JSON estruturado.
    Facilita a agregação por ferramentas como ELK ou Loki.
    """
    def __init__(self, service_name: str):
        super().__init__()
        self.service_name = service_name

    def format(self, record):
        log_record = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "service": self.service_name,
            "message": record.getMessage(),
            "module": record.module,
            "line": record.lineno,
        }
        if hasattr(record, "request_id"):
            log_record["request_id"] = record.request_id
            
        return json.dumps(log_record)

def get_logger(service_name: str) -> logging.Logger:
    """Retorna um logger configurado com formatador JSON."""
    logger = logging.getLogger(service_name)
    logger.setLevel(logging.INFO)
    
    # Evita duplicar handlers
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        formatter = JSONFormatter(service_name)
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        
    return logger
