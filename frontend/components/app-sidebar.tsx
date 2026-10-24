// The sidebar for LeetMeet
// Imports and uses modified shadcn components from sidebar.tsx, in a style similar to shadcn blocks

'use client';

import * as React from 'react';
import { usePathname } from "next/navigation";
import Link from 'next/link';
import { useTheme } from 'next-themes';

import {
  House,
  UserRound,
  ChevronDown,
  Plus,
  Settings,
  SunMoon,
  LogOut,
  ChevronRight,
  Check,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverMenuButton,
  PopoverTriggerMore,
  PopoverTriggerDropdown,
} from '@/components/ui/popover';

// enums for defined actions in various parts the sidebar
// passed into ActionMain(type), etc. to get the renderable component
enum ActionTypeMain {
  SignUp = 'Sign up',
  LogIn = 'Log in',
  CreatePost = 'New Post',
}
enum ActionTypeSubmenu {
  CreateFamily = 'Create Family',
}
enum ActionTypeUser {
  Settings = 'Settings',
  Appearance = 'Appearance',
  SignOut = 'Sign out',
}

// enum for enabled themes
enum Theme {
  system = 'System Default',
  light = 'Light',
  dark = 'Dark',
}

// Sample data that constructs the logged in sidebar
const loggedInData = {
  // The sidebar's navigation buttons (Home, Profile)
  navMain: [
    {
      title: 'Home',
      icon: House,
      url: '/',
    },
    {
      title: 'Profile',
      icon: UserRound,
      url: '/profile/this_is_a_sample_url',
    },
  ],
  // The sidebar's enabled actions (Create Post, Sign up, Log in)
  enabledActionsMain: [ActionTypeMain.CreatePost],
  // The sidebar's submenu (My Families)
  navSubmenu: {
    title: 'My Families',
    items: [
      {
        title: 'CS320 Group 3',
        url: '/family/this_is_a_sample_url',
      },
      {
        title: 'LeetMeet Frontend',
        url: '/family/this_is_another_sample_url',
      },
    ],
    enabledActions: [ActionTypeSubmenu.CreateFamily],
  },
  // User information, if available
  user: {
    title: 'User Name',
    profilePicture: 'https://assets.leetcode.com/users/default_avatar.jpg',
    enabledActions: [
      ActionTypeUser.Settings,
      ActionTypeUser.Appearance,
      ActionTypeUser.SignOut,
    ],
  },
};

// Sample data that constructs the logged out sidebar
const loggedOutData = {
  navMain: [
    {
      title: 'Home',
      icon: House,
      url: '#',
    },
  ],
  enabledActionsMain: [ActionTypeMain.SignUp, ActionTypeMain.LogIn],
};

// As there is currently no functionality, manually assign to preview either sidebar version
// Later, data should be constructed by properly checking authentication and fetching information
const data = loggedInData

/**
 * The SidebarMenu containing the main navigation (mapped from data.navMain)
 */
function NavMain() {

  const current = usePathname();

  return data.navMain ? (
    <SidebarMenu>
      {data.navMain.map((item) => {
        const LucideIcon = item.icon;

        return (
          <SidebarMenuItem key={item.title}>
            {/* <Link href={item.url}> */}
              <SidebarMenuButton isActive={item.url === current} render={<Link href={item.url} />}>
                  <LucideIcon />
                  {item.title}
              </SidebarMenuButton>
            {/* </Link> */}
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  ) : null;
}

/**
 * The SidebarMenuButton for sign up
 * On click, links to sign up page
 */
function SignUpButton() {
  return (
    <SidebarMenuButton variant="primaryRound">
      <Link href="/signup">{ActionTypeMain.SignUp}</Link>
    </SidebarMenuButton>
  );
}

/**
 * The SidebarMenuButton for log in
 * On click, links to log in page
 */
function LogInButton() {
  return (
    <SidebarMenuButton variant="secondaryRound">
      <Link href="/login">{ActionTypeMain.LogIn}</Link>
    </SidebarMenuButton>
  );
}

/**
 * The SidebarMenuButton for create post
 * TO DO: On click, open the Create Post dialog
 */
function CreatePostButton() {
  return (
    <SidebarMenuButton variant="primaryRound" className="pl-0">
      {/* This will need to be wrapped in a DialogTrigger instead of a div later */}
      <div className="flex items-center gap-3 -ml-4.5">
        <Plus />
        {ActionTypeMain.CreatePost}
      </div>
    </SidebarMenuButton>
  );
}

/**
 * Takes an ActionTypeMain and returns the corresponding SidebarMenuButton
 */
function ActionMain(type: ActionTypeMain) {
  switch (type) {
    case ActionTypeMain.SignUp:
      return SignUpButton;
    case ActionTypeMain.LogIn:
      return LogInButton;
    case ActionTypeMain.CreatePost:
      return CreatePostButton;
  }
}

/**
 * The SidebarMenu containing the main actions (mapped from data.enabledActionsMain)
 */
function ActionsMain() {
  return data.enabledActionsMain ? (
    <SidebarMenu className="mt-1.5">
      {data.enabledActionsMain.map((type) => {
        const Element = ActionMain(type);
        return (
          <SidebarMenuItem key={type} className="mt-0.5">
            <Element />
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  ) : null;
}

/**
 * Takes an ActionTypeSubmenu and returns the corresponding PopoverMenuButton
 * Note: there is only one ActionTypeSubmenu, but this is written to be extensible
 */
function ActionSubmenu(type: ActionTypeSubmenu) {
  switch (type) {
    case ActionTypeSubmenu.CreateFamily:
      return (
        <PopoverMenuButton key={type}>
          <Plus className="h-5! w-5!" />
          {type}
        </PopoverMenuButton>
      );
  }
}

/**
 * The Popover for submenu actions (mapped from data.navSubmenu.enabledActions)
 */
function NavSubmenuPopover() {
  return data.navSubmenu?.enabledActions ? (
    <Popover>
      <PopoverTriggerDropdown>
        <Plus />
      </PopoverTriggerDropdown>

      <PopoverContent>
        {data.navSubmenu.enabledActions.map((type) => ActionSubmenu(type))}
      </PopoverContent>
    </Popover>
  ) : null;
}

/**
 * The SidebarGroup containing the submenu (mapped from data.navSubmenu)
 */
function NavSubmenu() {

  const current = usePathname()

  return data.navSubmenu ? (
    <SidebarGroup className="px-4">
      <SidebarSeparator orientation="horizontal" className="mr-2 h-4 mt-5 mb-2.5" />

      <Collapsible
        key={data.navSubmenu.title}
        defaultOpen
        className="group/collapsible"
      >
        {/*Submenu header*/}
        <SidebarGroupLabel className="group/label pr-0">
          {/* Title and collapse icon that shows on hover */}
          <CollapsibleTrigger className="w-full flex items-center gap-1">
            <ChevronDown className="h-3 w-3 -ml-4 opacity-0 transition-opacity group-hover/label:opacity-100" />
            {data.navSubmenu.title}{' '}
          </CollapsibleTrigger>

          {/* Submenu actions popover */}
          <NavSubmenuPopover />
        </SidebarGroupLabel>

        {/* Collapsible list of submenu items, mapped from data.navSubmenu.items */}
        <SidebarGroupContent className="mt-1.5">
          <CollapsibleContent>
            <SidebarMenu className="px-0">
              {data.navSubmenu.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton size="sm" isActive={item.url === current} render={<Link href={item.url} />}>
                      {item.title}
                    </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </CollapsibleContent>
        </SidebarGroupContent>
      </Collapsible>
    </SidebarGroup>
  ) : null;
}

/**
 * The PopoverMenuButton for settings
 * On click, links to the account settings page
 */
function SettingPopoverButton() {
  return (
    <Link href="/settings">
      <PopoverMenuButton>
          <Settings className="h-5! w-5!" />
          {ActionTypeUser.Settings}
      </PopoverMenuButton>
    </Link>
  );
}

/**
 * The PopoverMenuButton for appearance
 * On click, triggers a secondary popover for choosing theme
 */
function AppearancePopoverButton() {
  
  const current = useTheme().theme || "system"
  const setTheme = useTheme().setTheme

  return (
    <Popover>
      <PopoverTrigger
        render={
          <PopoverMenuButton>
            <SunMoon className="h-5! w-5!" />
            {ActionTypeUser.Appearance}
            <ChevronRight className="h-3! w-3! ml-auto mt-1" />
          </PopoverMenuButton>
        }
      />

      <PopoverContent side="right" align="end" className="ml-1">
        {Object.entries(Theme).map(([theme, title]) => (
          <PopoverMenuButton key={title} onClick={() => setTheme(theme)}>
            <Check className={current !== theme ? "opacity-0" : undefined}/>
            {title}
          </PopoverMenuButton>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The PopoverMenuButton for sign 
 * TO DO: On click, signs the user out
 */
function SignOutPopoverButton() {
  return (
    // TO DO: make this onClick={() => supabase.auth.signOut()} once auth is fully set up
    <PopoverMenuButton>
      <LogOut className="h-4.5! w-4.5!" />
      {ActionTypeUser.SignOut}
    </PopoverMenuButton>
  );
}

/**
 * Takes an ActionTypeUser and returns the corresponding PopoverMenuButton
 */
function ActionUser(type: ActionTypeUser) {
  switch (type) {
    case ActionTypeUser.Settings:
      return <SettingPopoverButton key={type}/>
    case ActionTypeUser.Appearance:
      return <AppearancePopoverButton key={type} />;
    case ActionTypeUser.SignOut:
      return <SignOutPopoverButton key={type} />
  }
}

/**
 * The popover for user actions, mapped from user.enabledActions
 */
function UserActionsPopover() {
  return data.user?.enabledActions ? (
    <Popover>
      <PopoverTriggerMore />
      <PopoverContent>
        {data.user.enabledActions.map((type) => ActionUser(type))}
      </PopoverContent>
    </Popover>
  ) : null;
}

/**
 * The SidebarFooter (mapped from data.user)
 */
function AppSidebarFooter() {
  return data.user ? (
    <SidebarFooter>
      <SidebarMenu className="p-2">
        <SidebarMenuItem key="User" className="flex items-center w-full gap-3">
          <img
            src={data.user.profilePicture}
            className="h-12 w-12 rounded-full"
          />
          <span className="font-semibold">{data.user.title}</span>
          <UserActionsPopover />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  ) : null;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      {/* Sidebar header, links to Home */}
      {/* TO DO: replace text "LeetMeet" with logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" variant="noHover" render={<Link href="/" />}>
                <span className="font-medium">LeetMeet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Sidebar content, contains navigation, actions, and submenu */}
      <SidebarContent>
        <NavMain />
        <ActionsMain />
        <NavSubmenu />
      </SidebarContent>

      {/* Sidebar footer, displays user information if available */}
      <AppSidebarFooter />

      {/* Rail controlling sidebar width */}
      {/* Presently just being used as a separator, with actual sidebar resizing disabled */}
      <SidebarRail />
    </Sidebar>
  );
}
