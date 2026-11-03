#!/bin/sh
# Wraps the single-file game (written as a claude.ai artifact body) into a full page for GitHub Pages.
# usage: ./build.sh path/to/game.html
{
  printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="description" content="Fog-of-war army battle game. Find the enemy, keep your general alive, destroy their base.">\n'
  printf '<meta property="og:title" content="Hit and Run"><meta property="og:description" content="Fog-of-war army battle. Can you beat Invincible?"><meta name="theme-color" content="#11160f">\n'
  # leading title / icon / font links belong in <head>
  awk '/^<style>/{exit} {print}' "$1"
  printf '<style>html,body{margin:0;padding:0;height:100%%;background:#07090a}</style></head><body>\n'
  awk 'f||/^<style>/{f=1; print}' "$1"
  printf '\n</body></html>\n'
} > index.html
