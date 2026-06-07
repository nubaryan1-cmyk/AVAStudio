import { type Meta, type StoryObj } from "@storybook/react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/tabs.js";


const meta: Meta<typeof Tabs> = { title: "UI/Tabs", component: Tabs };
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-80">
      <TabsList>
        <TabsTrigger value="overview">Обзор</TabsTrigger>
        <TabsTrigger value="health">Здоровье</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">Сводка аккаунта.</TabsContent>
      <TabsContent value="health">Метрики здоровья.</TabsContent>
    </Tabs>
  ),
};
