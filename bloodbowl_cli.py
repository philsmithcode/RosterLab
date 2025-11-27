#!/usr/bin/env python3
"""
Blood Bowl roster generator CLI.

Usage:
  python bloodbowl_cli.py --team humans --tv 1000 --max-results 20 --min-players 11

TV is in thousands (1000 == 1,000,000 gp). Adjust rosters in get_rosters().
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import List, Dict


@dataclass
class Position:
    name: str
    cost: int  # in thousands
    max: int


@dataclass
class Combo:
    players: List[tuple]
    cost: int
    total_players: int


def get_rosters() -> Dict[str, Dict]:
    """Built-in sample rosters. Extend this to add more teams."""
    return {
        "humans": {
            "name": "Humans",
            "positions": [
                Position("Ogre", 140, 1),
                Position("Blitzer", 85, 2),
                Position("Catcher", 75, 2),
                Position("Thrower", 75, 2),
                Position("Lineman", 50, 16),
                Position("Halfling", 30, 4)
            ],
        },
        "orcs": {
            "name": "Orcs",
            "positions": [
                Position("Troll", 115, 1),
                Position("Black Orc", 90, 4),
                Position("Blitzer", 90, 4),
                Position("Thrower", 65, 2),
                Position("Lineman", 50, 16),
                Position("Goblin", 40, 4),
            ],
        },
    }


def generate_combos(positions: List[Position], tv: int, min_players: int, max_players: int, max_results: int, sort: str) -> List[Combo]:
    results: List[Combo] = []
    path: List[tuple] = []
    collect_cap = max_results * 500  # safety valve to avoid runaway searches

    def dfs(index: int, remaining: int, total_players: int) -> None:
        if total_players >= min_players:
            results.append(
                Combo(players=list(path), cost=tv - remaining, total_players=total_players)
            )
            # Continue to see if we can add more players within the budget.

        if index >= len(positions):
            return

        pos = positions[index]
        max_by_cost = remaining // pos.cost
        max_count = min(pos.max, max_by_cost, max_players - total_players)

        for count in range(max_count + 1):
            path.append((pos.name, count, pos.cost))
            dfs(index + 1, remaining - count * pos.cost, total_players + count)
            path.pop()
            if len(results) >= collect_cap:
                return

    dfs(0, tv, 0)

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
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rosters = get_rosters()
    team = rosters.get(args.team.lower())
    if not team:
        print(f"Unknown team '{args.team}'. Known teams: {', '.join(rosters.keys())}")
        return

    combos = generate_combos(
        positions=team["positions"],
        tv=args.tv,
        min_players=args.min_players,
        max_players=args.max_players,
        max_results=args.max_results,
        sort=args.sort,
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
