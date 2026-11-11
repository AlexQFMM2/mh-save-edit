"""Read frozen P3 reference HTML without network access or game-specific data.

Expanded cells retain their origin, so a colspan is never mistaken for two
independent reward columns. Output is evidence for review, not a runtime catalog.
"""
import hashlib
import json
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup


def require(condition, message):
    if not condition:
        raise ValueError(message)


def matrix(table):
    cells = {}
    rows = table.find_all('tr', recursive=False)
    if not rows:
        rows = [r for r in table.find_all('tr') if r.find_parent('table') is table]
    for y, row in enumerate(rows):
        x = 0
        for cell in row.find_all(['td', 'th'], recursive=False):
            while (y, x) in cells:
                x += 1
            width, height = int(cell.get('colspan', 1)), int(cell.get('rowspan', 1))
            require(1 <= width <= 32 and 1 <= height <= 256, 'Unexpected table span')
            value = dict(text=cell.get_text('\n', strip=True), origin=[y, x],
                         width=width, height=height, header=cell.name == 'th')
            for yy in range(y, y + height):
                for xx in range(x, x + width):
                    require((yy, xx) not in cells, 'Overlapping table cells')
                    cells[yy, xx] = value
            x += width
    width = max((x for _, x in cells), default=-1) + 1
    require(all(y < len(rows) for y, _ in cells), 'Rowspan extends outside table')
    return [[cells.get((y, x)) for x in range(width)] for y in range(len(rows))]


def read_page(directory):
    directory = Path(directory)
    metadata = json.loads((directory / 'source.json').read_bytes())
    raw = (directory / 'page.html').read_bytes()
    require(metadata['status'] == 200 and hashlib.sha256(raw).hexdigest() == metadata['sha256'], 'Reference hash/status mismatch')
    body = BeautifulSoup(raw, 'html.parser').select_one('#wikibody')
    require(body is not None, 'Reference body missing')
    headings, tables, sections = {}, [], []
    for element in body.find_all(['h2', 'h3', 'h4', 'table']):
        if element.name != 'table':
            level = int(element.name[1])
            headings = {k: v for k, v in headings.items() if k < level}
            headings[level] = element.get_text(' ', strip=True)
            # Preserve prose adjacent to tables; notes can qualify all their rows.
            prose = []
            for sibling in element.next_siblings:
                if getattr(sibling, 'name', None) in ('h2', 'h3', 'h4'):
                    break
                if getattr(sibling, 'name', None) == 'table':
                    continue
                if getattr(sibling, 'get_text', None):
                    text = sibling.get_text('\n', strip=True)
                    if text:
                        prose.append(text)
            sections.append(dict(headings=list(headings.values()), prose='\n'.join(prose)))
        elif not element.find_parent('table'):
            index = len(tables)
            tables.append(dict(key=f"{directory.name}:table:{index}", headings=list(headings.values()), cells=matrix(element)))
    require(tables, 'Reference tables missing')
    return dict(source=metadata, tables=tables, sections=sections)


def number(text):
    """Unknown values remain unknown, including dashes and numbers with notes."""
    return float(text) if re.fullmatch(r'\d+(?:\.\d+)?', text) else None


def status_cell(text):
    result = dict(toleranceInitial=None, toleranceIncrease=None, toleranceMax=None,
                  duration=None, damage=None, applicable=None, decayAmount=None,
                  decayIntervalSeconds=None, damageIntervalSeconds=None, damageUnit='unknown', rawJp=text)
    if text == '無効':
        return dict(result, applicable=False)
    lines = text.splitlines()
    require(len(lines) == 5, 'Unexpected status cell; retain for manual review: ' + text)
    result['toleranceInitial'] = number(lines[0])
    increase = re.fullmatch(r'(\d+)\((\d+)\)', lines[1])
    require(increase is not None, 'Unexpected tolerance increase')
    result.update(toleranceIncrease=int(increase[1]), toleranceMax=int(increase[2]))
    decay = re.fullmatch(r'(\d+)/(\d+)秒', lines[2])
    require(decay is not None, 'Unexpected status decay unit')
    result.update(decayAmount=int(decay[1]), decayIntervalSeconds=int(decay[2]), applicable=True)
    result['duration'] = number(lines[3].removesuffix('秒'))
    damage = re.fullmatch(r'(\d+)/(\d*)秒', lines[4])
    if damage:
        result.update(damage=int(damage[1]), damageIntervalSeconds=int(damage[2] or '1'), damageUnit='per-interval')
    else:
        result.update(damage=number(lines[4]), damageUnit='unspecified' if number(lines[4]) is not None else 'unknown')
    return result


if __name__ == '__main__':
    root, output = map(Path, sys.argv[1:])
    require(not output.exists(), 'Refusing to replace a reviewed snapshot')
    pages = {d.name: read_page(d) for d in sorted(root.glob('wiki-*'))}
    output.write_text(json.dumps(dict(schema='mhp3-monster-reference-tables-v1', pages=pages), ensure_ascii=False, indent=2) + '\n')
