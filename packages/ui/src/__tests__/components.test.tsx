import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Badge } from "../components/badge.js";
import { Button } from "../components/button.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/card.js";
import { cn } from "../lib/cn.js";

describe("cn", () => {
  it("разрешает конфликт Tailwind-классов (последний побеждает)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("отбрасывает falsy", () => {
    expect(cn("a", false, undefined, "b")).toBe("a b");
  });
});

describe("Button", () => {
  it("рендерит дочерний текст", () => {
    render(<Button>Сохранить</Button>);
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
  });
  it("применяет вариант destructive", () => {
    render(<Button variant="destructive">Удалить</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");
  });
  it("asChild рендерит ссылку вместо button", () => {
    render(
      <Button asChild>
        <a href="/x">Ссылка</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Ссылка" })).toBeInTheDocument();
  });
});

describe("Badge", () => {
  it("вариант success имеет emerald-фон", () => {
    render(<Badge variant="success">active</Badge>);
    expect(screen.getByText("active")).toHaveClass("bg-emerald-500");
  });
});

describe("Card", () => {
  it("композиция заголовок+контент", () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Заголовок</CardTitle>
        </CardHeader>
        <CardContent>Контент</CardContent>
      </Card>,
    );
    expect(screen.getByText("Заголовок")).toBeInTheDocument();
    expect(screen.getByText("Контент")).toBeInTheDocument();
  });
});
