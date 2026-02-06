import json
import os

# PATH TO GENERATED JSON (Local to this service)
JSON_PATH = os.path.join(os.path.dirname(__file__), '_GENERATED', 'state_machine.json')

def load_canon():
    if not os.path.exists(JSON_PATH):
        raise RuntimeError(f'Canon definition missing at {JSON_PATH}. Run CanonCompiler.')
    
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

_MODEL = load_canon()

CANON_STATES = frozenset(_MODEL['states'])
CANON_TRANSITIONS = {k: frozenset(v) for k, v in _MODEL['transitions'].items()}
FORBIDDEN_STATES = frozenset(_MODEL.get('_permanently_forbidden', []))

class CanonTransitionViolation(Exception):
    def __init__(self, error_code, from_state, to_state, site):
        self.error_code = error_code # FIX: Store attribute for tests
        self.from_state = from_state
        self.to_state = to_state
        self.site = site
        super().__init__(f'{error_code}: {from_state}->{to_state} @ {site}')

def validate_transition(from_state, to_state, site):
    # 1. Check Forbidden (Priority)
    if from_state in FORBIDDEN_STATES:
        raise CanonTransitionViolation('CANON_FORBIDDEN_STATE', from_state, to_state, site)
    if to_state in FORBIDDEN_STATES:
        raise CanonTransitionViolation('CANON_FORBIDDEN_STATE', from_state, to_state, site)

    # 2. Check Validity
    if from_state not in CANON_STATES:
        raise CanonTransitionViolation('CANON_INVALID_FROM', from_state, to_state, site)
    if to_state not in CANON_STATES:
        raise CanonTransitionViolation('CANON_INVALID_TO', from_state, to_state, site)
    
    # 3. Check Transition Logic
    if to_state not in CANON_TRANSITIONS.get(from_state, []):
        raise CanonTransitionViolation('CANON_TRANSITION_VIOLATION', from_state, to_state, site)

def validate_state(state, site):
    if state in FORBIDDEN_STATES:
        raise CanonTransitionViolation('CANON_FORBIDDEN_STATE', 'N/A', state, site)
    if state not in CANON_STATES:
        raise CanonTransitionViolation('CANON_INVALID_STATE', 'N/A', state, site)
