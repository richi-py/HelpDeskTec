import sys, os, base64
sys.path.append('C:/HelpDeskTec/HelpDeskTec/API')
from BackEnd.Functions import db

uploads_dir = 'C:/HelpDeskTec/HelpDeskTec/API/static/uploads'
for inc in db.incidencias.find():
    imagenes = inc.get('imagenes', [])
    updated = False
    new_imgs = []
    for img in imagenes:
        url = img.get('url', '')
        if 'localhost:5000' in url:
            filename = url.split('/')[-1]
            filepath = os.path.join(uploads_dir, filename)
            if os.path.exists(filepath):
                with open(filepath, 'rb') as f:
                    data = f.read()
                mime = 'image/png' if filename.endswith('.png') else 'image/jpeg'
                b64 = base64.b64encode(data).decode('utf-8')
                img['url'] = f'data:{mime};base64,{b64}'
                updated = True
                print(f"Migrada imagen de {inc.get('codigo')} ({filename}) a Base64")
        new_imgs.append(img)
    if updated:
        db.incidencias.update_one({'_id': inc['_id']}, {'$set': {'imagenes': new_imgs}})
print("Migración completada!")
