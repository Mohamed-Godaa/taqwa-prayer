s = open('cities.js', encoding='utf-8').read()
old = '{"n": "Jerusalem", "la": "33.6134048", "lo": "-87.8537086"}'
new = '{"n": "Jerusalem", "la": "31.7683197", "lo": "35.2137104"}'
assert old in s, 'pattern not found'
open('cities.js', 'w', encoding='utf-8').write(s.replace(old, new))
print('Jerusalem fixed to Al-Quds')
