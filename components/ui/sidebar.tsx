"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const Sidebar = React.forwardRef<HTMLDivElement, SidebarProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <aside
        ref={ref}
        className={cn(
          "flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar",
          className
        )}
        {...props}
      >
        {children}
      </aside>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex h-16 items-center border-b border-sidebar-border px-6", className)}
        {...props}
      />
    )
  }
)
SidebarHeader.displayName = "SidebarHeader"

const SidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex-1 overflow-y-auto px-4 py-4", className)}
        {...props}
      />
    )
  }
)
SidebarContent.displayName = "SidebarContent"

const SidebarItem = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground cursor-pointer",
          className
        )}
        {...props}
      />
    )
  }
)
SidebarItem.displayName = "SidebarItem"

export { Sidebar, SidebarHeader, SidebarContent, SidebarItem }
