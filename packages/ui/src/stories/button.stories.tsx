import { type Meta, type StoryObj } from "@storybook/react";

import { Button } from "../components/button.js";


const meta: Meta<typeof Button> = {
  title: "UI/Button",
  component: Button,
  args: { children: "Кнопка" },
};
export default meta;

type Story = StoryObj<typeof Button>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: "secondary" } };
export const Destructive: Story = { args: { variant: "destructive" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
