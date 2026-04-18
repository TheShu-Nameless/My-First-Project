package com.example.sms.util;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.Scanner;

public class ConsoleInput {
    private final Scanner scanner;

    public ConsoleInput(Scanner scanner) {
        this.scanner = scanner;
    }

    public String readNonBlank(String prompt) {
        while (true) {
            System.out.print(prompt);
            String text = scanner.nextLine().trim();
            if (!text.isEmpty()) {
                return text;
            }
            System.out.println("输入不能为空，请重试。");
        }
    }

    public String readOptional(String prompt) {
        System.out.print(prompt);
        return scanner.nextLine().trim();
    }

    public int readInt(String prompt, int min, int max) {
        while (true) {
            System.out.print(prompt);
            String text = scanner.nextLine().trim();
            try {
                int value = Integer.parseInt(text);
                if (value < min || value > max) {
                    System.out.printf("请输入 %d 到 %d 之间的整数。%n", min, max);
                    continue;
                }
                return value;
            } catch (NumberFormatException e) {
                System.out.println("输入不是有效整数，请重试。");
            }
        }
    }

    public double readDouble(String prompt, double min, double max) {
        while (true) {
            System.out.print(prompt);
            String text = scanner.nextLine().trim();
            try {
                double value = Double.parseDouble(text);
                if (value < min || value > max) {
                    System.out.printf("请输入 %.1f 到 %.1f 之间的数值。%n", min, max);
                    continue;
                }
                return value;
            } catch (NumberFormatException e) {
                System.out.println("输入不是有效数值，请重试。");
            }
        }
    }

    public LocalDate readDate(String prompt) {
        while (true) {
            System.out.print(prompt);
            String text = scanner.nextLine().trim();
            try {
                return LocalDate.parse(text);
            } catch (DateTimeParseException e) {
                System.out.println("日期格式错误，请使用 yyyy-MM-dd。");
            }
        }
    }

    public Integer parseOptionalInt(String text, int min, int max) {
        if (text == null || text.isBlank()) {
            return null;
        }
        int value = Integer.parseInt(text.trim());
        if (value < min || value > max) {
            throw new IllegalArgumentException("数值不在允许范围内");
        }
        return value;
    }

    public Double parseOptionalDouble(String text, double min, double max) {
        if (text == null || text.isBlank()) {
            return null;
        }
        double value = Double.parseDouble(text.trim());
        if (value < min || value > max) {
            throw new IllegalArgumentException("数值不在允许范围内");
        }
        return value;
    }

    public LocalDate parseOptionalDate(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        return LocalDate.parse(text.trim());
    }
}
