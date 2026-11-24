import express from 'express';

/** @param {{ limit: string }} opts */
export function jsonBody({ limit }) {
  return express.json({ limit, strict: false });
}
