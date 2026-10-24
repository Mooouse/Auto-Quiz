#!/usr/bin/env python3
"""Wikimedia Commons -> credited transparent PNG car pack. Visual QA remains required."""
import io
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image, ImageOps
from rembg import new_session, remove

ROOT=Path(__file__).resolve().parent.parent
MANIFEST=ROOT/"data/commons-batch-01.json"
CATALOG=ROOT/"public/data/cars.json"
IMGDIR=ROOT/"public/cars"
REPORT=ROOT/"docs/ASSET-INGEST-REPORT.json"
API="https://commons.wikimedia.org/w/api.php"

def request_json(http,params):
    for attempt in range(4):
        try:
            r=http.get(API,params=params,timeout=(15,60))
            r.raise_for_status()
            return r.json()
        except (requests.RequestException,ValueError):
            if attempt==3: raise
            time.sleep((attempt+1)*3)

def source(http,item):
    title="File:"+item["commonsFile"]
    j=request_json(http,{"action":"query","format":"json","formatversion":2,"prop":"imageinfo",
                         "iiprop":"url|extmetadata","iiurlwidth":1440,"titles":title})
    pages=j.get("query",{}).get("pages",[])
    if len(pages)!=1 or "imageinfo" not in pages[0]: raise ValueError("File not found on Commons")
    info=pages[0]["imageinfo"][0]
    metadata=info.get("extmetadata",{})
    license_name=re.sub(r"\s+"," ",metadata.get("LicenseShortName",{}).get("value","")).strip().lower()
    if license_name!=item["license"].lower():
        raise ValueError(f"License mismatch: Commons says {license_name!r}, expected {item['license']!r}")
    license_url=metadata.get("LicenseUrl",{}).get("value","")
    if "creativecommons.org/licenses/" not in license_url: raise ValueError("Unsupported source license URL")
    url=info.get("thumburl") or info.get("url")
    if not url or not url.startswith("https://"): raise ValueError("No HTTPS image URL")
    original="https://commons.wikimedia.org/wiki/"+quote(title.replace(" ","_"),safe=":()")
    return url,original

def download(http,url):
    for attempt in range(4):
        try:
            with http.get(url,timeout=(15,90),stream=True) as r:
                r.raise_for_status()
                chunks=[]; size=0
                for piece in r.iter_content(131072):
                    size+=len(piece)
                    if size>24_000_000: raise ValueError("Image larger than 24 MB")
                    chunks.append(piece)
                return b"".join(chunks)
        except requests.RequestException:
            if attempt==3: raise
            time.sleep((attempt+1)*3)

def background_remove(data,model):
    with Image.open(io.BytesIO(data)) as src:
        im=ImageOps.exif_transpose(src).convert("RGB")
    im.thumbnail((1400,1050),Image.Resampling.LANCZOS)
    if min(im.size)<230: raise ValueError("Image too small")
    out=remove(im,session=model).convert("RGBA")
    alpha=out.getchannel("A")
    box=alpha.point(lambda p:255 if p>=40 else 0).getbbox()
    if not box: raise ValueError("Foreground absent")
    l,t,r,b=box
    if r-l<im.width*.22 or b-t<im.height*.16: raise ValueError("Foreground too small")
    padding=max(12,round(max(r-l,b-t)*.05))
    crop=out.crop((max(0,l-padding),max(0,t-padding),min(im.width,r+padding),min(im.height,b+padding)))
    result=Image.new("RGBA",(crop.width+28,crop.height+28),(0,0,0,0))
    result.alpha_composite(crop,(14,14))
    buf=io.BytesIO()
    result.save(buf,"PNG",optimize=True,compress_level=8)
    if buf.tell()>6_000_000: raise ValueError("PNG larger than 6 MB")
    return buf.getvalue(),result.size

def main():
    cars=json.loads(CATALOG.read_text())
    items=json.loads(MANIFEST.read_text())["cars"]
    ids={c["id"] for c in cars}
    http=requests.Session()
    http.headers.update({"User-Agent":"AutoQuizAssetPrep/1.0 (https://github.com/Mooouse/Auto-Quiz)","Accept":"application/json,image/*,*/*"})
    model=None
    added=[];failures=[]
    for idx,item in enumerate(items,1):
        cid=item["id"]
        if cid in ids:
            if not (IMGDIR/(cid+".png")).exists(): raise RuntimeError("Missing PNG for existing entry: "+cid)
            print("Already included:",cid,flush=True)
            continue
        try:
            url,source_url=source(http,item)
            raw=download(http,url)
            if model is None: model=new_session("u2net")
            blob,size=background_remove(raw,model)
            (IMGDIR/(cid+".png")).write_bytes(blob)
            keys=("id","brand","model","generation","modification","fullName","aliases","image","categories","difficulty")
            car={key:item[key] for key in keys}
            car["origin"]="photograph"
            car["credits"]={"author":item["author"],"sourceUrl":source_url,
                             "license":item["license"],"licenseUrl":item["licenseUrl"],
                             "changes":"Background removed with U2Net; resized, cropped and exported as transparent PNG."}
            car["info"]="Real photograph from Wikimedia Commons. Full photo attribution and license on the credits page."
            cars.append(car);ids.add(cid)
            added.append({"id":cid,"size":size,"bytes":len(blob),"source":source_url})
            print(f"[{idx}/{len(items)}] Added {cid} ({size[0]}x{size[1]})",flush=True)
        except Exception as ex:
            failures.append({"id":cid,"reason":str(ex)[:260]})
            print(f"[{idx}/{len(items)}] Skipped {cid}: {ex}",file=sys.stderr,flush=True)
    CATALOG.write_text(json.dumps(cars,ensure_ascii=False,indent=2)+"\n")
    REPORT.write_text(json.dumps({"added":added,"failures":failures,"catalogSize":len(cars),
                                   "manualVisualQaCompleted":False},ensure_ascii=False,indent=2)+"\n")
    print("RESULT:",len(added),"new cars;",len(failures),"failed;",len(cars),"in catalog",flush=True)
    if not added and not any(item["id"] in ids for item in items):
        raise RuntimeError("All Commons downloads failed")

if __name__=="__main__":
    main()
