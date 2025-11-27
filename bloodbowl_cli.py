#!/usr/bin/env python3
"""
Blood Bowl roster generator CLI.

Usage:
  python bloodbowl_cli.py --team humans --tv 1000 --max-results 20 --min-players 11

TV is in thousands (1000 == 1,000,000 gp). Adjust rosters in get_rosters().
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from dataclasses import dataclass
from typing import List, Dict, Optional


@dataclass
class Position:
    name: str
    cost: int  # in thousands
    max: int
    type: str = "player"
    role: Optional[str] = None


@dataclass
class Combo:
    players: List[tuple]
    cost: int
    total_players: int


def get_rosters() -> Dict[str, Dict]:
    """Load BB2025 rosters scraped from bbtc.pl."""
    data_path = Path(__file__).with_name("bb2025_rosters.json")
    with data_path.open("r", encoding="utf8") as f:
        raw = json.load(f)

    rosters: Dict[str, Dict] = {}
    for key, team in raw.items():
        rosters[key] = {
            "name": team["name"],
            "positions": [Position(**pos) for pos in team["positions"]],
            "starPlayers": team.get("starPlayers", []),
            "inducements": team.get("inducements", []),
        }
    apply_aliases(rosters)
    return rosters


def apply_aliases(rosters: Dict[str, Dict]) -> None:
    aliases = {
        "humans": "human",
        "orcs": "orc",
        "dwarfs": "dwarf",
    }
    for alias, key in aliases.items():
        if key in rosters:
            rosters[alias] = rosters[key]


def build_positions(team: Dict, star_names: List[str], max_stars: int) -> List[Position]:
    base = team["positions"]
    stars = []
    for sp in team.get("starPlayers", []):
        if sp["name"].lower() in star_names:
            stars.append(Position(name=sp["name"], cost=sp["cost"], max=1, type="player", role="star"))
        if len(stars) >= max_stars:
            break
    return [*base, *stars]


def parse_stars(arg: Optional[str]) -> List[str]:
    if not arg:
        return []
    seen = []
    for s in arg.split(","):
        t = s.strip().lower()
        if t and t not in seen:
            seen.append(t)
        if len(seen) >= 2:
            break
    return seen


def generate_combos(
    positions: List[Position],
    tv: int,
    min_players: int,
    max_players: int,
    max_results: int,
    sort: str,
    max_stars: int,
) -> List[Combo]:
    results: List[Combo] = []
    path: List[tuple] = []
    collect_cap = max_results * 500  # safety valve to avoid runaway searches

    def dfs(index: int, remaining: int, total_players: int, stars: int) -> None:
        if total_players >= min_players:
            results.append(
                Combo(players=list(path), cost=tv - remaining, total_players=total_players)
            )
            # Continue to see if we can add more players within the budget.

        if index >= len(positions):
            return

        pos = positions[index]
        is_player = (pos.type or "player") == "player"
        max_by_cost = remaining // pos.cost
        player_room = max_players - total_players if is_player else max_players
        is_star = (pos.role or "").lower() == "star"
        star_room = max_stars - stars if is_star else max_stars
        max_count = min(pos.max, max_by_cost, player_room, star_room)

        for count in range(max_count + 1):
            path.append((pos.name, count, pos.cost))
            next_players = total_players + count if is_player else total_players
            next_stars = stars + count if is_star else stars
            dfs(index + 1, remaining - count * pos.cost, next_players, next_stars)
            path.pop()
            if len(results) >= collect_cap:
                return

    dfs(0, tv, 0, 0)

    filtered = [r for r in results if r.total_players <= max_players]
    if sort == "players":
        filtered.sort(key=lambda r: (-r.total_players, -r.cost))
    else:
        filtered.sort(key=lambda r: (-r.cost, -r.total_players))

    return filtered[:max_results]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate Blood Bowl player combos up to a target TV.")
    parser.add_argument("--team", required=True, help="Team key (humans, orcs). Edit get_rosters() to add more.")
    parser.add_argument("--tv", required=True, type=int, help="Team value in thousands (e.g. 1000 = 1,000,000).")
    parser.add_argument("--min-players", type=int, default=11, help="Minimum player count (default 11).")
    parser.add_argument("--max-players", type=int, default=16, help="Maximum player count (default 16).")
    parser.add_argument("--max-results", type=int, default=30, help="Limit number of combos returned (default 30).")
    parser.add_argument("--sort", choices=["cost", "players"], default="cost", help="Sort combos by total cost or player count.")
    parser.add_argument("--stars", help="Comma list of up to 2 star players to include.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rosters = get_rosters()
    team = rosters.get(args.team.lower())
    if not team:
        print(f"Unknown team '{args.team}'. Known teams: {', '.join(rosters.keys())}")
        return

    max_stars = 2
    stars = parse_stars(args.stars)
    if len(stars) > max_stars:
        print(f"Select at most {max_stars} stars.")
        return
    available_stars = [sp["name"].lower() for sp in team.get("starPlayers", [])]
    missing = [s for s in stars if s not in available_stars]
    if missing:
        print(f"Unknown star(s): {', '.join(missing)}. Available: {', '.join(available_stars) or 'none'}.")
        return

    positions = build_positions(team, stars, max_stars)

    combos = generate_combos(
        positions=positions,
        tv=args.tv,
        min_players=args.min_players,
        max_players=args.max_players,
        max_results=args.max_results,
        sort=args.sort,
        max_stars=max_stars,
    )

    if not combos:
        print("No combinations found under the given constraints.")
        return

    print(f"Team: {team['name']}")
    print(f"Target TV: {args.tv}k, min players: {args.min_players}, max players: {args.max_players}")
    print(f"Showing up to {args.max_results} combos (sorted by {args.sort}).\n")

    for idx, combo in enumerate(combos, start=1):
        lines = [f"{count} x {name} @ {cost}k" for name, count, cost in combo.players if count > 0]
        roster_text = "\n  ".join(lines) if lines else "(no players)"
        print(f"#{idx} | Cost: {combo.cost}k | Players: {combo.total_players}")
        print(f"  {roster_text}\n")


if __name__ == "__main__":
    main()
