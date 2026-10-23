# Inline the owner build (JS, CSS, fonts, logos) into one owner.html for gh-pages.
import sys,re,base64,os
dist,out=sys.argv[1:3]
html=open(f'{dist}/owner.html').read()
MT={'.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.webp':'image/webp'}
pat=re.compile(r'(?:\.\.?/|/)?assets/[\w/.-]+\.(?:jpg|png|svg|ttf|webp)')
def uri(m):
    p=re.sub(r'^(\.\.?/|/)','',m.group(0)); f=f'{dist}/{p}'
    if not os.path.exists(f): return m.group(0)
    return f'data:{MT[os.path.splitext(f)[1]]};base64,'+base64.b64encode(open(f,'rb').read()).decode()
js_path=re.search(r'src="\.?/?(assets/[^"]+\.js)"',html).group(1); css_path=re.search(r'href="\.?/?(assets/[^"]+\.css)"',html).group(1)
js=pat.sub(uri,open(f'{dist}/{js_path}').read()); css=pat.sub(uri,open(f'{dist}/{css_path}').read())
html=re.sub(r'\s*<script type="module"[^>]*></script>','',html); html=re.sub(r'\s*<link rel="stylesheet"[^>]*>','',html)
assert '</script>' not in js
html=html.replace('</head>','<style>'+css+'</style>\n</head>').replace('</body>','<script type="module">'+js+'</script>\n</body>')
open(out,'w').write(html); print(len(html),'leftover:',set(pat.findall(js+css)))
