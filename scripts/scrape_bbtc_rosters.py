import json
import re
import sys
import urllib.request
from html import unescape
from pathlib import Path

from bs4 import BeautifulSoup


BASE = "https://bbtc.pl"
INDEX_URL = f"{BASE}/roster/bb2025"
OUT_FILE = Path(__file__).resolve().parent.parent / "bb2025_rosters_detailed.json"
SOURCE_FILE = Path(__file__).resolve().parent.parent / "bb2025_rosters.json"


def fetch(url: str) -> str:
    with urllib.request.urlopen(url) as resp:  # nosec - trusted host controlled above
        return resp.read().decode("utf-8")


def parse_max(subtitle: str) -> int | None:
    match = re.search(r"0-(\d+)", subtitle)
    return int(match.group(1)) if match else None


def clean_stat(val: str) -> int | None:
    val = val.strip()
    if val in {"", "-", "—"}:
        return None
    return int(val.replace("+", ""))


def parse_keywords(subtitle: str) -> list[str]:
    parts = subtitle.split("|", 1)
    if len(parts) == 2:
        return [p.strip() for p in parts[1].split(",") if p.strip()]
    if subtitle:
        return [p.strip() for p in subtitle.split(",") if p.strip() and not re.match(r"0-\d+", p.strip())]
    return []


def parse_skills(cell) -> list[str]:
    text = cell.get_text(separator=",")
    return [unescape(s).strip() for s in text.split(",") if s.strip()]


def parse_positions(table):
    rows = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 10:
            continue
        name = tds[0].find("div").get_text(strip=True)
        subtitle = tds[0].find("small").get_text(strip=True)
        cost = int(tds[1].get_text(strip=True).replace("k", ""))
        rows.append(
            {
                "name": name,
                "subtitle": subtitle,
                "max": parse_max(subtitle),
                "cost": cost,
                "ma": clean_stat(tds[2].get_text()),
                "st": clean_stat(tds[3].get_text()),
                "ag": clean_stat(tds[4].get_text()),
                "pa": clean_stat(tds[5].get_text()),
                "av": clean_stat(tds[6].get_text()),
                "skills": parse_skills(tds[7]),
                "primary": tds[8].get_text(strip=True),
                "secondary": tds[9].get_text(strip=True),
                "keywords": parse_keywords(subtitle),
            }
        )
    return rows


def parse_inducements(table):
    items = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 2:
            continue
        name = tds[0].find("div").get_text(strip=True)
        subtitle = tds[0].find("small").get_text(strip=True)
        cost_raw = tds[1].get_text(strip=True)
        try:
            cost = int(cost_raw.replace("k", ""))
        except ValueError:
            continue
        items.append({"name": name, "max": parse_max(subtitle), "cost": cost})
    return items


def parse_star_players(table):
    stars = []
    for tr in table.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 7:
            continue
        name = tds[0].find("div").get_text(strip=True)
        subtitle = tds[0].find("small").get_text(strip=True)
        cost = int(tds[1].get_text(strip=True).replace("k", ""))
        stars.append(
            {
                "name": name,
                "affiliation": subtitle.strip(),
                "cost": cost,
                "ma": clean_stat(tds[2].get_text()),
                "st": clean_stat(tds[3].get_text()),
                "ag": clean_stat(tds[4].get_text()),
                "pa": clean_stat(tds[5].get_text()),
                "av": clean_stat(tds[6].get_text()),
                "skills": parse_skills(tds[7]),
            }
        )
    return stars


def parse_reroll_info(soup):
    text = soup.find(string=re.compile("team re-rolls", re.IGNORECASE))
    if not text:
        return None
    max_match = re.search(r"0-(\d+)", text)
    cost_match = re.search(r":\s*([0-9]+)k", text)
    return {
        "max": int(max_match.group(1)) if max_match else None,
        "cost": int(cost_match.group(1)) if cost_match else None,
    }


def parse_apothecary(soup):
    text = soup.find(string=re.compile("Apothecary", re.IGNORECASE))
    if not text:
        return None
    return "yes" in text.lower()


def parse_leagues_and_rules(soup):
    text = soup.find(string=re.compile("Leagues:", re.IGNORECASE))
    leagues = []
    rules = []
    if text and text.parent and text.parent.parent:
        row_text = text.parent.parent.get_text(" ", strip=True)
        leagues_match = re.search(r"Leagues:\s*(.*?)\s*\|\s*Special Rules:", row_text)
        rules_match = re.search(r"Special Rules:\s*(.*)", row_text)
        if leagues_match:
            leagues = [p.strip() for p in leagues_match.group(1).split("|") if p.strip()]
        if rules_match:
            rules = [p.strip() for p in rules_match.group(1).split("|") if p.strip() and p.strip().lower() != "none"]
    return leagues, rules


def find_table_by_header(soup, header_text):
  for card in soup.select("div.card"):
    h = card.find(["h4", "h5"])
    if h and h.get_text(strip=True).lower() == header_text.lower():
      table = card.find("table")
      if table:
        return table
  return None


def scrape_team(slug: str):
  html = fetch(f"{BASE}/roster/bb2025/{slug}")
  soup = BeautifulSoup(html, "html.parser")
  first_title = soup.find("h5", class_="card-title")
  name = first_title.get_text(strip=True) if first_title else slug

  pos_table = find_table_by_header(soup, "Position")
  if not pos_table:
    for table in soup.find_all("table"):
      header = table.find("th")
      if header and header.get_text(strip=True).lower() == "position":
        pos_table = table
        break
    ind_table = find_table_by_header(soup, "Inducements")
    star_table = find_table_by_header(soup, "Star players")

    positions = parse_positions(pos_table) if pos_table else []
    inducements = parse_inducements(ind_table) if ind_table else []
    stars = parse_star_players(star_table) if star_table else []
    rerolls = parse_reroll_info(soup)
    apoth = parse_apothecary(soup)
    leagues, special_rules = parse_leagues_and_rules(soup)

    return {
        "name": name,
        "positions": positions,
        "inducements": inducements,
        "starPlayers": stars,
        "rerolls": rerolls,
        "apothecary": apoth,
        "leagues": leagues,
        "specialRules": special_rules,
    }


def merge_with_existing(scraped: dict, existing: dict) -> dict:
    out = json.loads(json.dumps(existing))
    missing_positions = []
    missing_stars = []

    def norm_star(name: str) -> str:
        if not name:
            return ""
        cleaned = name
        patterns = [
            "Old World Classic",
            "Lustrian Superleague",
            "Badlands Brawl",
            "Worlds Edge Superleague",
            "Sylvanian Spotlight",
            "Elven Kingdom League",
            "Underworld Challenge",
            "Halfling Thimble Cup",
            "Woodland League",
            "Chaos Clash",
            r"Favoured of [^,]+",
        ]
        for pat in patterns:
            cleaned = re.sub(rf"(?:\s*[|,])?\s*{pat}", "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip().lower()

    for slug, team in out.items():
        src = scraped.get(slug)
        if not src:
            continue
        # merge positions
        pos_map = {p["name"].lower(): p for p in src["positions"]}
        for pos in team.get("positions", []):
            if (pos.get("type") or "player") != "player":
                continue
            key = pos.get("name", "").lower()
            if key not in pos_map:
                missing_positions.append((slug, pos.get("name")))
                continue
            src_pos = pos_map[key]
            pos.update(
                {
                    "ma": src_pos.get("ma"),
                    "st": src_pos.get("st"),
                    "ag": src_pos.get("ag"),
                    "pa": src_pos.get("pa"),
                    "av": src_pos.get("av"),
                    "skills": src_pos.get("skills", []),
                    "primary": src_pos.get("primary"),
                    "secondary": src_pos.get("secondary"),
                    "keywords": src_pos.get("keywords", []),
                }
            )
        # merge inducements and meta
        team["inducements"] = src.get("inducements", team.get("inducements", []))
        if src.get("rerolls"):
            team["rerolls"] = src["rerolls"]
        if src.get("apothecary") is not None:
            team["hasApothecary"] = bool(src["apothecary"])
        team["leagues"] = src.get("leagues", [])
        team["specialRules"] = src.get("specialRules", [])

        # merge star players
        star_map = {}
        for s in src.get("starPlayers", []):
            star_map[s["name"].lower()] = s
            star_map[norm_star(s["name"])] = s
        for star in team.get("starPlayers", []):
            key = star.get("name", "").lower()
            match = star_map.get(key) or star_map.get(norm_star(key))
            if not match:
                missing_stars.append((slug, star.get("name")))
                continue
            star.update(
                {
                    "ma": match.get("ma"),
                    "st": match.get("st"),
                    "ag": match.get("ag"),
                    "pa": match.get("pa"),
                    "av": match.get("av"),
                    "skills": match.get("skills", []),
                    "affiliation": match.get("affiliation", star.get("affiliation", "")),
                }
            )
    if missing_positions:
        print("Missing positions:", missing_positions, file=sys.stderr)
    if missing_stars:
        print("Missing star players:", missing_stars, file=sys.stderr)
    return out


def main():
    index_html = fetch(INDEX_URL)
    slugs = sorted(set(re.findall(r"/roster/bb2025/([a-z0-9-]+)", index_html)))
    scraped = {slug: scrape_team(slug) for slug in slugs}
    existing = json.loads(SOURCE_FILE.read_text())
    merged = merge_with_existing(scraped, existing)
    OUT_FILE.write_text(json.dumps(merged, indent=2))
    print(f"Wrote {OUT_FILE} with {len(merged)} teams.")


if __name__ == "__main__":
    main()
