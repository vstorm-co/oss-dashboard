"""Only copy public site files into the Pages artifact."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in ['index.html', 'styles.css', 'app.js', 'metrics.js']:
    shutil.copy2(root / name, out / name)
shutil.copytree(root / 'data', out / 'data')
(out / '.nojekyll').touch()
print('Built static site in dist/')
