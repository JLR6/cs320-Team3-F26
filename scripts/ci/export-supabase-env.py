"""Export only local test values, masking keys instead of printing credentials."""
import json
import os
import sys
from pathlib import Path

values = json.loads(Path(sys.argv[1]).read_text())
with open(os.environ['GITHUB_ENV'], 'a') as output:
    for source, target in [('API_URL', 'SUPABASE_URL'), ('ANON_KEY', 'SUPABASE_ANON_KEY'), ('SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY')]:
        value = values[source]
        if '\n' in value or '\r' in value:
            raise ValueError('Unexpected multiline Supabase value')
        if source != 'API_URL':
            print(f'::add-mask::{value}')
        output.write(f'{target}={value}\n')
