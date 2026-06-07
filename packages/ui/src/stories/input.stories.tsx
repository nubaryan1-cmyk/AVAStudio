import { type Meta, type StoryObj } from "@storybook/react";

import { Input } from "../components/input.js";
import { Label } from "../components/label.js";


const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  args: { placeholder: "you@example.com" },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {};
export const WithLabel: Story = {
  render: (args) => (
    <div className="space-y-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" {...args} />
    </div>
  ),
};
