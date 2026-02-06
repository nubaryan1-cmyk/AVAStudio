import json
import os

SOURCE = ros.getcwd()
DEST_NET = ros.getcwd()
DEST_PY = ros.getcwd()

def main():
    if not os.path.exists(SOURCE):
        print('Error: Source not found')
        exit(1)
        
    states = []
    transitions = {}
    mode = None
    
    with open(SOURCE, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.split('#')[0].strip()
            if not line: continue
            if line == '[STATES]': mode = 'st'; continue
            if line == '[TRANSITIONS]': mode = 'tr'; continue
            
            if mode == 'st': states.append(line)
            if mode == 'tr' and '->' in line:
                s, d = line.split('->')
                transitions[s.strip()] = [x.strip() for x in d.split(',') if x.strip()]

    data = {
        '_meta': 'Generated from STATE_MODEL.txt',
        'states': states,
        'transitions': transitions,
        '_permanently_forbidden': ['PAUSED', 'RETRYING']
    }
    
    js = json.dumps(data, indent=2)
    
    for p in [DEST_NET, DEST_PY]:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f: f.write(js)
        print(f'Artifact wrote: {p}')

if __name__ == '__main__':
    main()
