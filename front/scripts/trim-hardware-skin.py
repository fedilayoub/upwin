"""Rebuild components/ui/hardware/skin.css from the SPEC-01 registry.

The registry's `hardware` item ships one skin for every component it has:
29 stylesheets, about 480 KB, a third of it embedded textures. This app uses
a few of those components, so the skin is cut down to the rules they need.

  curl -o /tmp/hardware.json https://spec-01.vercel.app/r/hardware.json
  python3 scripts/trim-hardware-skin.py /tmp/hardware.json

A rule is kept when every `data-kit` it names is in KITS and it names no
other kit-only attribute; rules that name no kit at all (the root, tokens)
are kept too. Custom properties, @property and @keyframes that nothing kept
refers to are then dropped, which is what removes the textures.

To use another component from the registry, add its `data-kit` names to KITS
and run this again. Local changes belong in app.css, not in skin.css.
"""
import json
import pathlib
import re
import sys

KITS = {
    "field", "label", "meter", "meter-track", "meter-indicator",
    "segmented", "segmented-indicator", "segment", "led",
    "slide-switch", "slide-switch-lever", "slide-switch-stop",
    "mode-dial", "mode-dial-scale", "mode-dial-knob", "mode-dial-pointer",
    "mode-stop", "mode-stop-label",
    "wheel-frame", "wheel-rail", "wheel", "wheel-item", "wheel-face",
}
# State the kept components set on themselves. Any other data attribute in a
# selector belongs to a component, demo or page this app does not have.
STATE_ATTRS = {
    "skin", "kit", "checked", "selected", "open", "dragging", "orientation",
    "side", "disabled", "modality", "ridge",
}
OUT = pathlib.Path(__file__).resolve().parent.parent / "components/ui/hardware/skin.css"

IMPORT_RE = re.compile(r'@import "\./([^"]+)"')
KIT_RE = re.compile(r'data-kit([\^$*~|]?)=\s*"?([^"\]]+)"?')
ATTR_RE = re.compile(r"\[data-([a-z-]+)")
FLAT_NOT_RE = re.compile(r":not\(([^()]*)\)")
FLAT_LIST_RE = re.compile(r":(is|where)\(([^()]*)\)")
VAR_RE = re.compile(r"var\(\s*(--[\w-]+)")
CUSTOM_RE = re.compile(r"(--[\w-]+)\s*:")


def skip_inert(text, i):
    """The index just past a comment or string starting at i, or i."""
    if text.startswith("/*", i):
        end = text.find("*/", i + 2)
        return len(text) if end < 0 else end + 2
    if text[i] in "\"'":
        quote, j = text[i], i + 1
        while j < len(text) and text[j] != quote:
            j += 2 if text[j] == "\\" else 1
        return j + 1
    return i


def strip_comments(text):
    out, i = [], 0
    while i < len(text):
        if text.startswith("/*", i):
            i = skip_inert(text, i)
        elif text[i] in "\"'":
            j = skip_inert(text, i)
            out.append(text[i:j])
            i = j
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def items(text):
    """A block body as ('decl', text) and ('rule', prelude, body) items."""
    out, i, start, parens = [], 0, 0, 0
    while i < len(text):
        j = skip_inert(text, i)
        if j != i:
            i = j
            continue
        ch = text[i]
        if ch == "(":
            parens += 1
        elif ch == ")":
            parens -= 1
        elif ch == ";" and parens == 0:
            if text[start:i].strip():
                out.append(("decl", text[start:i].strip()))
            start = i + 1
        elif ch == "{" and parens == 0:
            depth, j = 1, i + 1
            while j < len(text) and depth:
                k = skip_inert(text, j)
                if k != j:
                    j = k
                    continue
                depth += {"{": 1, "}": -1}.get(text[j], 0)
                j += 1
            out.append(("rule", text[start:i].strip(), text[i + 1 : j - 1]))
            i = start = j
            continue
        i += 1
    if text[start:].strip():
        out.append(("decl", text[start:].strip()))
    return out


def split_list(text):
    parts, depth, cur = [], 0, ""
    for ch in text:
        depth += {"(": 1, "[": 1, ")": -1, "]": -1}.get(ch, 0)
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    return parts + ([cur.strip()] if cur.strip() else [])


def ours(selector):
    if any(attr not in STATE_ATTRS for attr in ATTR_RE.findall(selector)):
        return False
    return all(not op and kit in KITS for op, kit in KIT_RE.findall(selector))


def filter_selector(selector):
    """The selector with other kits removed from its :is() and :where()
    lists, or None when it still targets something this app does not have."""
    while True:
        dropped, emptied = False, False

        def keep(match):
            nonlocal dropped, emptied
            args = split_list(match.group(2))
            # A negated kit only says what the element is not.
            kept = [a for a in args if ours(FLAT_NOT_RE.sub("", a))]
            dropped |= len(kept) != len(args)
            emptied |= not kept
            return f":{match.group(1)}({', '.join(kept)})"

        selector = FLAT_LIST_RE.sub(keep, selector)
        if emptied:
            return None
        if not dropped:
            break
    return selector if ours(FLAT_NOT_RE.sub("", selector)) else None


def trim(text):
    out = []
    for item in items(text):
        if item[0] == "decl":
            out.append(item)
            continue
        _, prelude, body = item
        if prelude.startswith(("@keyframes", "@property", "@font-face")):
            out.append(("raw", prelude, body.strip()))
        elif prelude.startswith("@"):
            kids = trim(body)
            if kids:
                out.append(("rule", prelude, kids))
        else:
            selectors = [s for s in map(filter_selector, split_list(prelude)) if s]
            kids = trim(body)
            if selectors and kids:
                out.append(("rule", ", ".join(selectors), kids))
    return out


def decls(nodes):
    for node in nodes:
        if node[0] == "decl":
            yield node[1]
        elif node[0] == "rule":
            yield from decls(node[2])
        elif node[0] == "raw" and node[1].startswith("@keyframes"):
            yield node[2]


def prune(nodes, used, animated):
    out = []
    for node in nodes:
        if node[0] == "decl":
            custom = CUSTOM_RE.match(node[1])
            if not custom or custom.group(1) in used:
                out.append(node)
        elif node[0] == "rule":
            kids = prune(node[2], used, animated)
            if kids:
                out.append(("rule", node[1], kids))
        elif node[1].startswith("@property"):
            if node[1].split()[1] in used:
                out.append(node)
        elif node[1].startswith("@keyframes"):
            if re.search(r"\b" + re.escape(node[1].split()[1]) + r"\b", animated):
                out.append(node)
        else:
            out.append(node)
    return out


def emit(nodes, indent=0):
    pad, text = "  " * indent, ""
    for node in nodes:
        if node[0] == "decl":
            text += f"{pad}{node[1]};\n"
        elif node[0] == "raw":
            body = "\n".join(f"{pad}  {line.strip()}" for line in node[2].splitlines() if line.strip())
            text += f"{pad}{node[1]} {{\n{body}\n{pad}}}\n"
        else:
            text += f"{pad}{node[1]} {{\n{emit(node[2], indent + 1)}{pad}}}\n"
    return text


def main():
    registry = json.load(open(sys.argv[1]))
    sheets = {f["path"].split("/")[-1]: f["content"] for f in registry["files"] if f["path"].endswith(".css")}
    order = IMPORT_RE.findall(sheets["skin.css"])
    trees = {name: trim(strip_comments(sheets[name])) for name in order}

    # Which custom properties does anything kept read? A custom property
    # counts only once something that is read refers to it.
    every = [d for name in order for d in decls(trees[name])]
    plain = [d for d in every if not CUSTOM_RE.match(d)]
    custom = [(CUSTOM_RE.match(d).group(1), d) for d in every if CUSTOM_RE.match(d)]
    used = {name for d in plain for name in VAR_RE.findall(d)}
    while True:
        more = {name for prop, d in custom if prop in used for name in VAR_RE.findall(d)} - used
        if not more:
            break
        used |= more
    animated = " ".join(d for d in plain if d.startswith("animation"))

    out = (
        "/* Generated by scripts/trim-hardware-skin.py from the SPEC-01 registry\n"
        "   (https://spec-01.vercel.app/r/hardware.json). Do not edit: change KITS in\n"
        "   the script and run it again, and keep local rules in app.css.\n"
        f"   Kits: {', '.join(sorted(KITS))}. */\n"
    )
    for name in order:
        body = emit(prune(trees[name], used, animated))
        if body.strip():
            out += f"\n/* {name} */\n{body}"
    OUT.write_text(out)
    full = sum(len(sheets[name]) for name in order)
    print(f"{OUT.name}: {len(out)} bytes, from {full} in {len(order)} sheets")


main()
