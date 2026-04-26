import { detectSqlDumpFormat } from "@/lib/tauri-api";

describe("detectSqlDumpFormat", () => {
  it("should detect phpMyAdmin dumps and database names from USE statements", () => {
    const result = detectSqlDumpFormat("-- phpMyAdmin SQL Dump\nUSE `analytics`;\nSELECT 1;");

    expect(result).toEqual({
      detectedFormat: "phpmyadmin",
      detectedDbName: "analytics",
    });
  });

  it("should detect pg_dump dumps and strip quoted connect names", () => {
    const result = detectSqlDumpFormat('-- PostgreSQL database dump\n\\connect "Reporting"\n');

    expect(result).toEqual({
      detectedFormat: "pg_dump",
      detectedDbName: "Reporting",
    });
  });

  it("should detect SQLite dumps from pragma headers", () => {
    expect(detectSqlDumpFormat("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;")).toEqual({
      detectedFormat: "sqlite_cli",
      detectedDbName: null,
    });
  });

  it("should fall back to CREATE DATABASE when no direct connection marker exists", () => {
    expect(detectSqlDumpFormat("CREATE DATABASE sample_db;\n")).toEqual({
      detectedFormat: "generic",
      detectedDbName: "sample_db",
    });
  });
});
