import { type Meta, type StoryObj } from "@storybook/react";

import { Badge } from "../components/badge.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/card.js";


const meta: Meta<typeof Card> = { title: "UI/Card", component: Card };
export default meta;

type Story = StoryObj<typeof Card>;

export const AccountCard: Story = {
  render: () => (
    <Card className="w-80">
      <CardHeader>
        <CardTitle>@brand.demo</CardTitle>
        <CardDescription>Instagram · phone</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <Badge variant="success">active</Badge>
        <Badge variant="secondary">health 92</Badge>
      </CardContent>
    </Card>
  ),
};
