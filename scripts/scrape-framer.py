import requests
from bs4 import BeautifulSoup
from datetime import datetime
import xml.etree.ElementTree as ET
from xml.dom import minidom
import re

SITE_URL = "https://www.asclub.pt/noticias"
FEED_TITLE = "AS CLUB - Notícias"
FEED_DESCRIPTION = "Últimas notícias de finanças e investimentos do AS Club"
FEED_LINK = "https://www.asclub.pt"

def parse_date(date_str):
    """Converte data no formato dd/mm/yyyy para datetime"""
    try:
        return datetime.strptime(date_str.strip(), "%d/%m/%Y")
    except:
        return datetime.now()

def scrape_noticias():
    """Busca as notícias da página do Framer"""
    print(f"A buscar notícias de {SITE_URL}...")
    
    response = requests.get(SITE_URL, headers={"User-Agent": "ASClub-RSS-Bot/1.0"})
    response.raise_for_status()
    
    soup = BeautifulSoup(response.content, 'html.parser')
    noticias = []
    
    # Procura todos os links que contêm /noticias/ no href
    links = soup.find_all('a', href=re.compile(r'/noticias/[^/]+$'))
    
    for link in links[:30]:  # Últimas 30 notícias
        try:
            # Extrai o URL
            url = link.get('href')
            if not url.startswith('http'):
                url = FEED_LINK + url
                # Remove ponto duplicado se existir
                url = url.replace('.pt./', '.pt/')
                url = url.replace('asclub.pt.', 'asclub.pt')
            
            # Extrai o título (h3 dentro do link)
            titulo_elem = link.find(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
            if not titulo_elem:
                continue
            
            titulo = titulo_elem.get_text(strip=True)
            
            # Procura a data (normalmente está antes do título)
            data_elem = link.find_previous(['div', 'span', 'p'], string=re.compile(r'\d{2}/\d{2}/\d{4}'))
            if data_elem:
                data_texto = data_elem.get_text(strip=True)
                data = parse_date(data_texto)
            else:
                data = datetime.now()
            
            # Descrição = título (Framer CMS geralmente não mostra excerpt na listagem)
            descricao = titulo
            
            noticias.append({
                'titulo': titulo,
                'link': url,
                'descricao': descricao,
                'data': data
            })
            
        except Exception as e:
            print(f"Erro ao processar notícia: {e}")
            continue
    
    # Remove duplicados por URL
    seen = set()
    noticias_unicas = []
    for n in noticias:
        if n['link'] not in seen:
            seen.add(n['link'])
            noticias_unicas.append(n)
    
    print(f"✓ Encontradas {len(noticias_unicas)} notícias")
    return noticias_unicas

def gerar_rss(noticias):
    """Gera o ficheiro RSS XML"""
    rss = ET.Element('rss', version='2.0')
    rss.set('xmlns:atom', 'http://www.w3.org/2005/Atom')
    rss.set('xmlns:dc', 'http://purl.org/dc/elements/1.1/')
    
    channel = ET.SubElement(rss, 'channel')
    ET.SubElement(channel, 'title').text = FEED_TITLE
    ET.SubElement(channel, 'link').text = FEED_LINK
    ET.SubElement(channel, 'description').text = FEED_DESCRIPTION
    ET.SubElement(channel, 'language').text = 'pt'
    ET.SubElement(channel, 'lastBuildDate').text = datetime.now().strftime('%a, %d %b %Y %H:%M:%S +0000')
    
    # Self-link
    atom_link = ET.SubElement(channel, 'atom:link')
    atom_link.set('href', 'https://axtancap.github.io/asclub-feeds/rss.xml')
    atom_link.set('rel', 'self')
    atom_link.set('type', 'application/rss+xml')
    
    for noticia in noticias:
        item = ET.SubElement(channel, 'item')
        ET.SubElement(item, 'title').text = noticia['titulo']
        ET.SubElement(item, 'link').text = noticia['link']
        ET.SubElement(item, 'description').text = noticia['descricao']
        ET.SubElement(item, 'pubDate').text = noticia['data'].strftime('%a, %d %b %Y %H:%M:%S +0000')
        ET.SubElement(item, 'guid', isPermaLink='true').text = noticia['link']
        ET.SubElement(item, 'dc:creator').text = 'AS CLUB'
    
    # Formata com indentação
    xml_str = minidom.parseString(ET.tostring(rss, encoding='utf-8')).toprettyxml(indent="  ", encoding='utf-8')
    
    with open('rss.xml', 'wb') as f:
        f.write(xml_str)
    
    print(f"✓ RSS gerado: rss.xml ({len(noticias)} items)")

if __name__ == "__main__":
    try:
        noticias = scrape_noticias()
        if noticias:
            gerar_rss(noticias)
        else:
            print("⚠ Nenhuma notícia encontrada!")
    except Exception as e:
        print(f"❌ Erro: {e}")
        raise
