export const PACKAGE_NAME = "@avastudio/ui";

export { cn } from "./lib/cn.js";

export { Button, buttonVariants, type ButtonProps } from "./components/button.js";
export { Badge, badgeVariants, type BadgeProps } from "./components/badge.js";
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./components/card.js";
export { Input, type InputProps } from "./components/input.js";
export { Label } from "./components/label.js";
export { Skeleton } from "./components/skeleton.js";
export { Avatar, AvatarImage, AvatarFallback } from "./components/avatar.js";
export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "./components/table.js";
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/tabs.js";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "./components/dialog.js";
export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  type SheetContentProps,
} from "./components/sheet.js";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "./components/dropdown-menu.js";
export {
  Toast,
  ToastProvider,
  ToastViewport,
  ToastClose,
  ToastTitle,
  ToastDescription,
  type ToastItem,
} from "./components/toast.js";
export { Toaster } from "./components/toaster.js";
export { useToast, type UseToastResult } from "./components/use-toast.js";
export {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "./components/form.js";

export { ThemeProvider, useTheme, type Theme, type ThemeProviderProps } from "./theme/theme-provider.js";
export { ThemeToggle } from "./theme/theme-toggle.js";
