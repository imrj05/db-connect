import { describe, expect, it } from "vitest";
import { detectSqlDumpFormat } from "@/lib/tauri-api";

describe("detectSqlDumpFormat", () => {
    it("detects pg_dump format and database name from \\connect", () => {
        const sample = "-- PostgreSQL database dump\n\\connect my_database\n\nCREATE TABLE foo (id int);";
        const result = detectSqlDumpFormat(sample);
        expect(result.detectedFormat).toBe("pg_dump");
        expect(result.detectedDbName).toBe("my_database");
    });

    it("detects phpMyAdmin format", () => {
        const sample = "-- phpMyAdmin SQL Dump\n-- version 5.0\nCREATE TABLE bar (id int);";
        const result = detectSqlDumpFormat(sample);
        expect(result.detectedFormat).toBe("phpmyadmin");
    });

    it("detects SQLite CLI format and falls back to CREATE DATABASE", () => {
        const sample = "PRAGMA foreign_keys=OFF;\nCREATE TABLE t (id INTEGER);";
        const result = detectSqlDumpFormat(sample);
        expect(result.detectedFormat).toBe("sqlite_cli");
    });

    it("detects database from USE statement", () => {
        const sample = "USE my_db;\nSELECT 1;";
        const result = detectSqlDumpFormat(sample);
        expect(result.detectedFormat).toBe("generic");
        expect(result.detectedDbName).toBe("my_db");
    });

    it("detects database from CREATE DATABASE", () => {
        const sample = "CREATE DATABASE IF NOT EXISTS shop_db;\nSELECT 1;";
        const result = detectSqlDumpFormat(sample);
        expect(result.detectedFormat).toBe("generic");
        expect(result.detectedDbName).toBe("shop_db");
    });
});
