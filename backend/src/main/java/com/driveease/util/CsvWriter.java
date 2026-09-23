package com.driveease.util;

import java.util.List;

/**
 * Minimal RFC 4180 CSV writer. Every field is quoted and internal quotes are
 * doubled, so commas, quotes and newlines inside customer data cannot break the
 * export or inject extra columns (PRD US-03-07).
 */
public final class CsvWriter {

    private CsvWriter() {
    }

    public static String write(List<String> headers, List<List<?>> rows) {
        StringBuilder out = new StringBuilder();
        writeRow(out, headers);
        for (List<?> row : rows) {
            writeRow(out, row);
        }
        return out.toString();
    }

    private static void writeRow(StringBuilder out, List<?> values) {
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) {
                out.append(',');
            }
            out.append(escape(values.get(i)));
        }
        out.append("\r\n");
    }

    private static String escape(Object value) {
        if (value == null) {
            return "";
        }
        String text = String.valueOf(value);
        // Prefix formula characters so spreadsheet software never evaluates them.
        if (!text.isEmpty() && "=+-@".indexOf(text.charAt(0)) >= 0) {
            text = "'" + text;
        }
        return '"' + text.replace("\"", "\"\"") + '"';
    }
}
