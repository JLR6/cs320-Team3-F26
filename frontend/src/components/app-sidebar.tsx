// The sidebar for LeetMeet
// Imports and uses modified shadcn components from sidebar.tsx, in a style similar to shadcn blocks

'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/use-user';
import { getUserByUsername } from '@/lib/api/users';
import { apiFetch } from '@/lib/api/client';

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
  type LucideIcon,
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

// Structure of data that constructs the sidebar
type SidebarData = {
  navMain: {
    title: string;
    icon: LucideIcon;
    url: string;
  }[];
  enabledActionsMain: ActionTypeMain[];
  navSubmenu?: {
    title: string;
    items: { title: string; url: string }[];
    noItemsMessage?: string;
    enabledActions: ActionTypeSubmenu[];
  };
  user?: {
    title: string;
    profilePicture: string;
    enabledActions: ActionTypeUser[];
  };
};

// Sample data that constructs the logged in sidebar
const loggedInData: SidebarData = {
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
      url: '#',
    },
  ],
  // The sidebar's enabled actions (Create Post, Sign up, Log in)
  enabledActionsMain: [ActionTypeMain.CreatePost],
  // The sidebar's submenu (My Families)
  navSubmenu: {
    title: 'My Families',
    items: [],
    // noItemsMessage: 'You are not part of any LeetMeet families',
    enabledActions: [ActionTypeSubmenu.CreateFamily],
  },
  // User information, if available
  user: {
    title: 'Loading...',
    profilePicture: 'https://assets.leetcode.com/users/default_avatar.jpg',
    enabledActions: [
      ActionTypeUser.Settings,
      ActionTypeUser.Appearance,
      ActionTypeUser.SignOut,
    ],
  },
};

// Sample data that constructs the logged out sidebar
const loggedOutData: SidebarData = {
  navMain: [
    {
      title: 'Home',
      icon: House,
      url: '/',
    },
  ],
  enabledActionsMain: [ActionTypeMain.SignUp, ActionTypeMain.LogIn],
};

/**
 * The SidebarMenu containing the main navigation (mapped from data.navMain)
 */
function NavMain({ data }: { data: SidebarData['navMain'] }) {
  const current = usePathname();

  return data ? (
    <SidebarMenu>
      {data.map((item) => {
        const LucideIcon = item.icon;

        return (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={item.url === current}
              render={<Link href={item.url} />}
            >
              <LucideIcon />
              {item.title}
            </SidebarMenuButton>
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
    <SidebarMenuButton variant="primaryRound" render={<Link href="/signup" />}>
      {ActionTypeMain.SignUp}
    </SidebarMenuButton>
  );
}

/**
 * The SidebarMenuButton for log in
 * On click, links to log in page
 */
function LogInButton() {
  return (
    <SidebarMenuButton variant="secondaryRound" render={<Link href="/login" />}>
      {ActionTypeMain.LogIn}
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
function ActionsMain({ data }: { data: SidebarData['enabledActionsMain'] }) {
  return data.length ? (
    <SidebarMenu className="mt-1.5">
      {data.map((type) => {
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
function NavSubmenuPopover({ data }: { data: ActionTypeSubmenu[] }) {
  return data.length ? (
    <Popover>
      <PopoverTriggerDropdown>
        <Plus />
      </PopoverTriggerDropdown>

      <PopoverContent>{data.map((type) => ActionSubmenu(type))}</PopoverContent>
    </Popover>
  ) : null;
}

/**
 * The SidebarGroup containing the submenu (mapped from data.navSubmenu)
 */
function NavSubmenu({ data }: { data: SidebarData['navSubmenu'] }) {
  const current = usePathname();

  return data ? (
    <SidebarGroup className="px-4">
      <SidebarSeparator
        orientation="horizontal"
        className="mr-2 h-4 mt-5 mb-2.5"
      />

      <Collapsible key={data.title} defaultOpen className="group/collapsible">
        {/*Submenu header*/}
        <SidebarGroupLabel className="group/label pr-0">
          {/* Title and collapse icon that shows on hover */}
          <CollapsibleTrigger className="w-full flex items-center gap-1">
            <ChevronDown className="h-3 w-3 -ml-4 opacity-0 transition-opacity group-hover/label:opacity-100" />
            {data.title}{' '}
          </CollapsibleTrigger>

          {/* Submenu actions popover */}
          <NavSubmenuPopover data={data.enabledActions} />
        </SidebarGroupLabel>

        {/* Collapsible list of submenu items, mapped from data.navSubmenu.items */}
        <SidebarGroupContent className="mt-1.5">
          <CollapsibleContent>
            <SidebarMenu className="px-0">
              {data.items?.length ? (
                data.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      size="sm"
                      isActive={item.url === current}
                      render={<Link href={item.url} />}
                    >
                      {item.title}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <span className="px-2 text-muted-foreground">
                  {' '}
                  {data.noItemsMessage}{' '}
                </span>
              )}
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
  const current = useTheme().theme || 'system';
  const setTheme = useTheme().setTheme;

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
            <Check className={current !== theme ? 'opacity-0' : undefined} />
            {title}
          </PopoverMenuButton>
        ))}
      </PopoverContent>
    </Popover>
  );
}

/**
 * The PopoverMenuButton for sign
 * On click, signs the user out
 */
function SignOutPopoverButton() {
  return (
    <PopoverMenuButton onClick={() => createClient().auth.signOut()}>
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
      return <SettingPopoverButton key={type} />;
    case ActionTypeUser.Appearance:
      return <AppearancePopoverButton key={type} />;
    case ActionTypeUser.SignOut:
      return <SignOutPopoverButton key={type} />;
  }
}

/**
 * The popover for user actions, mapped from user.enabledActions
 */
function UserActionsPopover({ actions }: { actions: ActionTypeUser[] }) {
  return actions ? (
    <Popover>
      <PopoverTriggerMore />
      <PopoverContent>{actions.map((type) => ActionUser(type))}</PopoverContent>
    </Popover>
  ) : null;
}

/**
 * The SidebarFooter (mapped from data.user)
 */
function AppSidebarFooter({ data }: { data: SidebarData['user'] }) {
  return data ? (
    <SidebarFooter>
      <SidebarMenu className="p-2">
        <SidebarMenuItem key="User" className="flex items-center w-full gap-3">
          <img src={data.profilePicture} className="h-12 w-12 rounded-full" />
          <span className="font-semibold">{data.title}</span>
          <UserActionsPopover actions={data.enabledActions} />
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  ) : null;
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  // authentication state
  const authUser = useUser();
  const username = authUser?.user_metadata.username;
  const data = authUser ? { ...loggedInData } : { ...loggedOutData };

  // data to be loaded for the logged in sidebar
  const [families, setFamilies] = React.useState<
    { title: string; url: string }[]
  >([]);
  const [profilePicture, setProfilePicture] = React.useState<
    string | undefined
  >();

  React.useEffect(() => {
    if (!username) return;

    apiFetch('/user-families').then((json) => {
      const memberships = json as {id: string}[];
      setFamilies(
        memberships.map((membership) => ({
          title: membership.id,
          url: `/families/${membership.id}`,
        })),
      );
    });
    getUserByUsername(username).then((json) => {
      setProfilePicture(json.profile_picture ?? undefined);
    });
  }, [username]);

  if (username) {
    data.navMain[1].url = `/profile/${username}`;
    data.navSubmenu!.items = families;
    data.user!.title = username;
    if (profilePicture) data.user!.profilePicture = profilePicture;
  }

  return (
    <Sidebar {...props}>
      {/* Sidebar header, links to Home */}
      {/* TO DO: replace text "LeetMeet" with logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              variant="noHover"
              render={<Link href="/" />}
            >
              <span className="font-medium">LeetMeet</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* Sidebar content, contains navigation, actions, and submenu */}
      <SidebarContent>
        <NavMain data={data.navMain} />
        <ActionsMain data={data.enabledActionsMain} />
        <NavSubmenu data={data.navSubmenu} />
      </SidebarContent>

      {/* Sidebar footer, displays user information if available */}
      <AppSidebarFooter data={data.user} />

      {/* Rail controlling sidebar width */}
      {/* Presently just being used as a separator, with actual sidebar resizing disabled */}
      <SidebarRail />
    </Sidebar>
  );
}
