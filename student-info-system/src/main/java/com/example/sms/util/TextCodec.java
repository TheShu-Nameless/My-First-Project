package com.example.sms.util;

import java.util.ArrayList;
import java.util.List;

public final class TextCodec {
    private static final char DELIMITER = '|';
    private static final char ESCAPE = '\\';

    private TextCodec() {
    }

    public static String encodeField(String field) {
        if (field == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (char c : field.toCharArray()) {
            if (c == DELIMITER || c == ESCAPE) {
                sb.append(ESCAPE);
            }
            sb.append(c);
        }
        return sb.toString();
    }

    public static String decodeField(String field) {
        StringBuilder sb = new StringBuilder();
        boolean escaping = false;
        for (char c : field.toCharArray()) {
            if (escaping) {
                sb.append(c);
                escaping = false;
            } else if (c == ESCAPE) {
                escaping = true;
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }

    public static String joinFields(String... fields) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < fields.length; i++) {
            if (i > 0) {
                sb.append(DELIMITER);
            }
            sb.append(encodeField(fields[i]));
        }
        return sb.toString();
    }

    public static List<String> splitFields(String line) {
        List<String> result = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean escaping = false;
        for (char c : line.toCharArray()) {
            if (escaping) {
                current.append(c);
                escaping = false;
            } else if (c == ESCAPE) {
                escaping = true;
            } else if (c == DELIMITER) {
                result.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        result.add(current.toString());

        for (int i = 0; i < result.size(); i++) {
            result.set(i, decodeField(result.get(i)));
        }
        return result;
    }
}
