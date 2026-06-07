import { type Meta, type StoryObj } from "@storybook/react";

import { Badge } from "../components/badge.js";


const meta: Meta<typeof Badge> = {
  title: "UI/Badge",
  component: Badge,
  args: { children: "active" },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Success: Story = { args: { variant: "success", children: "warmed_up" } };
export const Warning: Story = { args: { variant: "warning", children: "checkpoint" } };
export const Destructive: Story = { args: { variant: "destructive", children: "banned" } };
