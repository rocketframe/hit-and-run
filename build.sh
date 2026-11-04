#!/bin/sh
# Wraps the single-file game (written as a claude.ai artifact body) into a full page for GitHub Pages.
# usage: ./build.sh path/to/game.html
{
  printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="description" content="Fog-of-war army battle game. Find the enemy, keep your general alive, destroy their base.">\n'
  printf '<meta property="og:title" content="Hit and Run"><meta property="og:description" content="Fog-of-war army battle. Can you beat Invincible?"><meta name="theme-color" content="#11160f">\n'
  printf '<meta property="og:type" content="website"><meta property="og:url" content="https://rocketframe.github.io/hit-and-run/"><meta property="og:image" content="https://rocketframe.github.io/hit-and-run/icons/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image">\n'
  printf '<link rel="apple-touch-icon" href="icons/icon-180.png"><link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">\n'
  # leading title / icon / font links belong in <head>
  awk '/^<style>/{exit} {print}' "$1"
  printf '<style>html,body{margin:0;padding:0;height:100%%;background:#07090a}</style></head><body>\n'
  awk 'f||/^<style>/{f=1; print}' "$1"
  printf '\n</body></html>\n'
} > index.html
