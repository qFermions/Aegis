#!/usr/bin/env python3
"""Generates the two animated SVGs for the Aegis README.

docs/assets/aegis-demo.svg: a terminal that types an ask-aegis command and prints the reply Aegis
wrote for the person who asked. The reply text is real output, copied word for word from
docs/aegis/demo/evidence/batch11/asker-replies.md (ticket DEV14).
docs/assets/aegis-flow.svg: how a ticket moves: ticket, Aegis reads, two answers, a person makes
the change, Aegis checks it worked.

Both use CSS keyframes (opacity and transform only) plus SMIL motion, no script, no external font,
and show their final frame when the viewer asks for reduced motion.
"""
import html
import os

OUT = os.path.dirname(os.path.abspath(__file__))


MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', 'DejaVu Sans Mono', monospace"
SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"


def esc(s):
    return html.escape(s, quote=False)


# ---------------------------------------------------------------- demo terminal
def demo():
    W, H = 880, 440
    FS = 13
    CW = FS * 0.6          # monospace advance; textLength pins every line to this grid
    X0 = 30
    LH = 21
    T = 18.0               # seconds per loop

    def pct(t):
        return f"{t / T * 100:.2f}%"

    css = []
    body = []
    y = 78

    # three command lines, typed
    cmd = [
        [('$ ', '#3fb950'), ('node scripts/ask-aegis.js ', '#e6edf3'), ('--reply-to asker', '#ff7b72'), (' \\', '#8b949e')],
        [('    ', '#e6edf3'), ('"Nobody at the second office can get into Outlook or Teams \\', '#a5d6ff')],
        [('     ', '#e6edf3'), ('since about 10 this morning. Head office seems fine."', '#a5d6ff')],
    ]
    type_windows = [(0.6, 2.4), (2.5, 4.2), (4.3, 5.6)]
    for i, (parts, (t0, t1)) in enumerate(zip(cmd, type_windows)):
        text = ''.join(p for p, _ in parts)
        n = len(text)
        skip = 2 if i == 0 else 0          # the "$ " prompt is there from the start
        tspans = ''.join(f'<tspan fill="{c}">{esc(p)}</tspan>' for p, c in parts)
        body.append(f'<text x="{X0}" y="{y}" textLength="{n * CW:.1f}" lengthAdjust="spacingAndGlyphs">{tspans}</text>')
        # a cover the colour of the screen slides right in steps, so the line appears as if typed
        start_x = X0 + skip * CW
        dist = (n - skip) * CW
        steps = n - skip
        name = f'type{i}'
        css.append(f'.{name}{{transform:translateX({dist:.1f}px);animation:{name} {T}s infinite}}'
                   f'@keyframes {name}{{0%,{pct(t0)}{{transform:translateX(0);animation-timing-function:steps({steps},end)}}'
                   f'{pct(t1)},100%{{transform:translateX({dist:.1f}px)}}}}')
        css.append(f'.caret{i}{{opacity:0;animation:caret{i} {T}s infinite}}'
                   f'@keyframes caret{i}{{0%,{pct(t0 - 0.01 if i else 0)}{{opacity:{1 if i == 0 else 0}}}'
                   f'{pct(t0)},{pct(t1 + 0.15)}{{opacity:1}}{pct(t1 + 0.2)},100%{{opacity:0}}}}')
        body.append(f'<g class="{name}"><rect x="{start_x:.1f}" y="{y - 15}" width="{dist + 40:.1f}" height="{LH}" fill="#0d1117"/>'
                    f'<rect class="caret{i}" x="{start_x:.1f}" y="{y - 13}" width="{CW:.1f}" height="16" fill="#e6edf3"/></g>')
        y += LH

    # the working badge in the title bar, then the done badge
    css.append(f'.wait{{opacity:0;animation:wait {T}s infinite}}@keyframes wait{{0%,{pct(5.7)}{{opacity:0}}{pct(5.9)},{pct(7.8)}{{opacity:1}}{pct(8.0)},100%{{opacity:0}}}}')
    css.append(f'.done{{opacity:1;animation:done {T}s infinite}}@keyframes done{{0%,{pct(7.9)}{{opacity:0}}{pct(8.2)},{pct(16.8)}{{opacity:1}}{pct(17.4)},100%{{opacity:0}}}}')
    css.append(f'.dot{{animation:dot 1.2s infinite}}@keyframes dot{{0%,100%{{opacity:.25}}50%{{opacity:1}}}}')

    y += 10
    reply = [
        ["Something at your office seems to be blocking Outlook and Teams. It doesn't look like a",
         "problem with anyone's account, because head office is working normally."],
        ["So far I've only read your message. I haven't confirmed the cause yet: it could be your",
         "office's internet connection, its link to head office, or a network setting."],
        ["For now, you can use Teams or Outlook on a phone with Wi-Fi switched off, or call colleagues",
         "directly. A technician will check your office's network connection next and will tell you",
         "once things work again."],
    ]
    fade_in = [8.2, 9.3, 10.4]
    for k, (para, t0) in enumerate(zip(reply, fade_in)):
        name = f'p{k}'
        css.append(f'.{name}{{animation:{name} {T}s infinite}}@keyframes {name}{{0%,{pct(t0)}{{opacity:0;transform:translateY(6px)}}'
                   f'{pct(t0 + 0.5)},{pct(16.8)}{{opacity:1;transform:translateY(0)}}{pct(17.4)},100%{{opacity:0;transform:translateY(0)}}}}')
        lines = []
        for line in para:
            lines.append(f'<text x="{X0}" y="{y}" textLength="{len(line) * CW:.1f}" lengthAdjust="spacingAndGlyphs" fill="#e6edf3">{esc(line)}</text>')
            y += LH
        body.append(f'<g class="{name}">{"".join(lines)}</g>')
        y += 9

    y += 6
    tail = [
        ('Reply saved: ~/aegis-asks/<ask>/reply.md', '#8b949e', 12.0),
        ('Full tech answer saved: ~/aegis-asks/<ask>/answer.md', '#8b949e', 12.4),
        ('Cost: 0.23 US dollars', '#8b949e', 12.8),
        ('The reply passed its form check. It is text for you to send; Aegis sent nothing.', '#3fb950', 13.4),
    ]
    for k, (line, color, t0) in enumerate(tail):
        name = f's{k}'
        css.append(f'.{name}{{animation:{name} {T}s infinite}}@keyframes {name}{{0%,{pct(t0)}{{opacity:0}}{pct(t0 + 0.3)},{pct(16.8)}{{opacity:1}}{pct(17.4)},100%{{opacity:0}}}}')
        body.append(f'<text class="{name}" x="{X0}" y="{y}" textLength="{len(line) * CW:.1f}" lengthAdjust="spacingAndGlyphs" fill="{color}">{esc(line)}</text>')
        y += LH

    # the command lines fade out with the rest at the end of the loop
    css.append(f'.cmd{{animation:cmd {T}s infinite}}@keyframes cmd{{0%,{pct(16.8)}{{opacity:1}}{pct(17.4)},100%{{opacity:0}}}}')

    assert y < H - 20, y
    style = (f'text{{font-family:{MONO};font-size:{FS}px;white-space:pre}}'
             f'.ui{{font-family:{SANS}}}'
             + ''.join(css)
             + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}')

    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="t d">
<title id="t">Aegis answering a ticket in a terminal</title>
<desc id="d">Someone types: node scripts/ask-aegis.js --reply-to asker, with the ticket "Nobody at the second office can get into Outlook or Teams since about 10 this morning. Head office seems fine." Aegis prints a three-paragraph reply for the person who asked, saves the full tech answer, reports a cost of 0.23 US dollars and says it sent nothing. The reply is real output from the batch 11 evidence.</desc>
<style>{style}</style>
<defs><clipPath id="screen"><rect x="10" y="10" width="{W - 20}" height="{H - 20}" rx="12"/></clipPath></defs>
<rect x="10" y="10" width="{W - 20}" height="{H - 20}" rx="12" fill="#0d1117" stroke="#30363d"/>
<g clip-path="url(#screen)">
<rect x="10" y="10" width="{W - 20}" height="36" fill="#161b22"/>
<line x1="10" y1="46" x2="{W - 10}" y2="46" stroke="#30363d"/>
<circle cx="32" cy="28" r="6" fill="#ff5f57"/><circle cx="52" cy="28" r="6" fill="#febc2e"/><circle cx="72" cy="28" r="6" fill="#28c840"/>
<text class="ui" x="{W / 2}" y="33" text-anchor="middle" fill="#8b949e" style="font-family:{SANS};font-size:13px">Aegis · the reply to the person who asked</text>
<g class="wait"><rect x="{W - 250}" y="17" width="226" height="22" rx="11" fill="#1f6feb" fill-opacity="0.18" stroke="#1f6feb" stroke-opacity="0.6"/>
<text x="{W - 237}" y="32" fill="#79c0ff" style="font-family:{SANS};font-size:12px">Aegis is reading its runbooks</text>
<circle class="dot" cx="{W - 50}" cy="28" r="2.5" fill="#79c0ff"/><circle class="dot" style="animation-delay:.2s" cx="{W - 42}" cy="28" r="2.5" fill="#79c0ff"/><circle class="dot" style="animation-delay:.4s" cx="{W - 34}" cy="28" r="2.5" fill="#79c0ff"/></g>
<g class="done"><rect x="{W - 250}" y="17" width="226" height="22" rx="11" fill="#238636" fill-opacity="0.18" stroke="#3fb950" stroke-opacity="0.6"/>
<text x="{W - 137}" y="32" text-anchor="middle" fill="#3fb950" style="font-family:{SANS};font-size:12px">advice only · nothing was changed</text></g>
<g class="cmd">{"".join(body[:6])}</g>
{"".join(body[6:])}
</g>
</svg>
'''
    open(os.path.join(OUT, 'aegis-demo.svg'), 'w').write(svg)


# ---------------------------------------------------------------- flow
def flow():
    W, H = 880, 280
    T = 10.0
    CY = 128
    nodes = {
        'ticket': (14, CY - 48, 150, 96, ['A ticket', 'in plain words'], '1'),
        'reads': (190, CY - 48, 150, 96, ['Aegis reads', 'its runbooks and', 'read-only checks'], '2'),
        'card': (366, CY - 92, 150, 76, ['Fix card', 'for the IT tech'], '3'),
        'reply': (366, CY + 16, 150, 76, ['Reply', 'for the person', 'who asked'], '3'),
        'human': (542, CY - 48, 150, 96, ['A person', 'makes the change'], '4'),
        'check': (718, CY - 48, 150, 96, ['Aegis checks', 'it really worked'], '5'),
    }
    # when the travelling dot reaches each node, as a share of the loop (motion runs over 0 to 0.8)
    seg = [176, 180.7, 180.7, 176]
    total = sum(seg)
    arrive = [0]
    for s in seg:
        arrive.append(arrive[-1] + s / total * 0.8)
    hit = {'ticket': arrive[0], 'reads': arrive[1], 'card': arrive[2], 'reply': arrive[2], 'human': arrive[3], 'check': arrive[4]}

    css = [f'text{{font-family:{SANS}}}',
           '.flowline{stroke-dasharray:6 6;animation:flowline 1s linear infinite}@keyframes flowline{to{stroke-dashoffset:-12}}']
    parts = []
    # connectors
    def line(x1, y1, x2, y2):
        parts.append(f'<path class="flowline" d="M{x1} {y1} L{x2} {y2}" stroke="#8b949e" stroke-width="2" fill="none" marker-end="url(#arrow)"/>')
    line(164, CY, 186, CY)
    line(340, CY - 10, 362, CY - 54)
    line(340, CY + 10, 362, CY + 54)
    line(516, CY - 54, 538, CY - 10)
    line(692, CY, 714, CY)

    for key, (x, y, w, h, lines, num) in nodes.items():
        t = hit[key] * 100
        a, b, c = max(t - 2, 0), t + 1, t + 12
        name = f'hl_{key}'
        if t < 2:
            kf = f'0%{{opacity:1}}{c:.1f}%{{opacity:0}}100%{{opacity:0}}'
        else:
            kf = f'0%,{a:.1f}%{{opacity:0}}{b:.1f}%{{opacity:1}}{c:.1f}%,100%{{opacity:0}}'
        css.append(f'.{name}{{opacity:0;animation:{name} {T}s infinite}}@keyframes {name}{{{kf}}}')
        is_human = key == 'human'
        stroke = '#d29922' if is_human else '#30363d'
        parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="#161b22" stroke="{stroke}" stroke-width="1.5"/>')
        parts.append(f'<rect class="{name}" x="{x - 3}" y="{y - 3}" width="{w + 6}" height="{h + 6}" rx="14" fill="none" stroke="#58a6ff" stroke-width="3"/>')
        parts.append(f'<circle cx="{x + 18}" cy="{y + 18}" r="10" fill="{"#d29922" if is_human else "#1f6feb"}"/>'
                     f'<text x="{x + 18}" y="{y + 22.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#ffffff">{num}</text>')
        ty = y + h / 2 - (len(lines) - 1) * 9 + 6
        for i, ln in enumerate(lines):
            weight = '700' if i == 0 else '400'
            size = 15 if i == 0 else 12.5
            color = '#e6edf3' if i == 0 else '#9da7b3'
            parts.append(f'<text x="{x + w / 2 + 8}" y="{ty + i * 18:.1f}" text-anchor="middle" font-size="{size}" font-weight="{weight}" fill="{color}">{esc(ln)}</text>')

    # travelling dots (SMIL), drawn under the boxes so they show only on the connectors
    main = f'M89 {CY} L265 {CY} L441 {CY - 54} L617 {CY} L793 {CY}'
    k1 = f'{arrive[1]:.3f}'
    k2 = f'{arrive[2]:.3f}'
    dots = (f'<circle r="5" fill="#58a6ff"><animateMotion dur="{T}s" repeatCount="indefinite" path="{main}" keyPoints="0;1;1" keyTimes="0;0.8;1" calcMode="linear"/></circle>'
            f'<circle r="5" fill="#58a6ff" opacity="0"><animateMotion dur="{T}s" repeatCount="indefinite" path="M265 {CY} L441 {CY + 54}" keyPoints="0;0;1;1" keyTimes="0;{k1};{k2};1" calcMode="linear"/>'
            f'<animate attributeName="opacity" dur="{T}s" repeatCount="indefinite" values="0;0;1;1;0;0" keyTimes="0;{float(k1) - 0.005:.3f};{k1};{k2};{float(k2) + 0.005:.3f};1"/></circle>')

    caption = (f'<text x="{W / 2}" y="{H - 22}" text-anchor="middle" font-size="13" fill="#8b949e">'
               'Aegis advises. Step 4 is always a person: Aegis cannot change accounts, devices or tickets.</text>')

    style = ''.join(css) + '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-labelledby="ft fd">
<title id="ft">How a ticket moves through Aegis</title>
<desc id="fd">Five steps: 1, a ticket in plain words. 2, Aegis reads its runbooks and read-only checks. 3, two answers: a Fix card for the IT tech and a reply for the person who asked. 4, a person makes the change. 5, Aegis checks it really worked. Aegis cannot change accounts, devices or tickets itself.</desc>
<style>{style}</style>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#8b949e"/></marker></defs>
{dots}
{"".join(parts)}
{caption}
</svg>
'''
    open(os.path.join(OUT, 'aegis-flow.svg'), 'w').write(svg)


demo()
flow()
print('written to', OUT)
