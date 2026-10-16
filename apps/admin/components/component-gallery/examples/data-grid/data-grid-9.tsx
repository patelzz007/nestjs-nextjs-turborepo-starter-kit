"use client";

import * as React from "react";
import { useCallback, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge, type BadgeVariant } from "@workspace/ui/components/badge";
import { Card } from "@workspace/ui/components/card";
import { DataGrid, DataGridContainer, dataGridFeatures, type DataGridFeatures, type DataGridTableLayout } from "@workspace/ui/components/data-grid/data-grid";
import { DataGridColumnHeader } from "@workspace/ui/components/data-grid/data-grid-column-header";
import { DataGridPagination } from "@workspace/ui/components/data-grid/data-grid-pagination";
import { DataGridScrollArea } from "@workspace/ui/components/data-grid/data-grid-scroll-area";
import { DataGridTable, DataGridTableRowExpand } from "@workspace/ui/components/data-grid/data-grid-table";
import {
	useTable,
	type CellContext,
	type ColumnDef,
	type ColumnOrderState,
	type ExpandedState,
	type HeaderContext,
	type PaginationState,
	type Row,
	type SortingState,
} from "@tanstack/react-table";

interface OrderItem {
	readonly id: string;
	readonly productName: string;
	readonly category: string;
	readonly price: string;
	readonly quantity: number;
}

interface OrderStatus {
	readonly label: string;
	readonly variant: BadgeVariant;
}

interface Order {
	readonly id: string;
	readonly orderNumber: string;
	readonly customer: string;
	readonly customerEmail: string;
	readonly customerAvatar: string;
	readonly total: string;
	readonly status: OrderStatus;
	readonly items: readonly OrderItem[];
}

const ORDERS: readonly Order[] = [
	{
		id: "1",
		orderNumber: "SO-001",
		customer: "Alex Johnson",
		customerEmail: "alex@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		total: "$459.97",
		status: {
			label: "Shipped",
			variant: "primary-light",
		},
		items: [
			{
				id: "1-1",
				productName: "Wireless Headphones",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "1-2",
				productName: "Phone Case",
				category: "Accessories",
				price: "$99.99",
				quantity: 1,
			},
			{
				id: "1-3",
				productName: "Screen Protector",
				category: "Accessories",
				price: "$29.99",
				quantity: 2,
			},
			{
				id: "1-4",
				productName: "Charging Cable",
				category: "Electronics",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "1-5",
				productName: "Bluetooth Speaker",
				category: "Electronics",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "1-6",
				productName: "Phone Stand",
				category: "Accessories",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "1-7",
				productName: "Cable Management",
				category: "Accessories",
				price: "$19.99",
				quantity: 2,
			},
			{
				id: "1-8",
				productName: "Wireless Charger",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "1-9",
				productName: "Gaming Mouse",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "1-10",
				productName: "Gaming Keyboard",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "1-11",
				productName: "Mouse Pad",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "1-12",
				productName: "Desk Lamp",
				category: "Home",
				price: "$79.99",
				quantity: 1,
			},
		],
	},
	{
		id: "2",
		orderNumber: "SO-002",
		customer: "Sarah Chen",
		customerEmail: "sarah@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		total: "$249.48",
		status: {
			label: "Processing",
			variant: "info-light",
		},
		items: [
			{
				id: "2-1",
				productName: "Running Shoes",
				category: "Sports",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "2-2",
				productName: "Sports Socks",
				category: "Sports",
				price: "$59.51",
				quantity: 1,
			},
			{
				id: "2-3",
				productName: "Water Bottle",
				category: "Sports",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "2-4",
				productName: "Fitness Tracker",
				category: "Electronics",
				price: "$74.99",
				quantity: 1,
			},
		],
	},
	{
		id: "3",
		orderNumber: "SO-003",
		customer: "Michael Rodriguez",
		customerEmail: "michael@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		total: "$189.97",
		status: {
			label: "Delivered",
			variant: "success-light",
		},
		items: [
			{
				id: "3-1",
				productName: "Coffee Mug",
				category: "Home",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "3-2",
				productName: "Coffee Beans",
				category: "Food",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "3-3",
				productName: "Coffee Grinder",
				category: "Home",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "3-4",
				productName: "Milk Frother",
				category: "Home",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "3-5",
				productName: "Coffee Filter",
				category: "Home",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "3-6",
				productName: "Sugar Bowl",
				category: "Home",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "3-7",
				productName: "Tea Set",
				category: "Home",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "3-8",
				productName: "Creamer",
				category: "Food",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "3-9",
				productName: "Coffee Table",
				category: "Furniture",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "3-10",
				productName: "Placemats",
				category: "Home",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "3-11",
				productName: "Napkins",
				category: "Home",
				price: "$7.99",
				quantity: 1,
			},
			{
				id: "3-12",
				productName: "Candles",
				category: "Home",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "3-13",
				productName: "Vase",
				category: "Home",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "3-14",
				productName: "Flowers",
				category: "Home",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "3-15",
				productName: "Table Runner",
				category: "Home",
				price: "$18.99",
				quantity: 1,
			},
		],
	},
	{
		id: "4",
		orderNumber: "SO-004",
		customer: "Emma Wilson",
		customerEmail: "emma@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		total: "$299.97",
		status: {
			label: "Cancelled",
			variant: "destructive-light",
		},
		items: [
			{
				id: "4-1",
				productName: "Laptop Stand",
				category: "Electronics",
				price: "$99.99",
				quantity: 1,
			},
			{
				id: "4-2",
				productName: "Wireless Mouse",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "4-3",
				productName: "Keyboard",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "4-4",
				productName: "Monitor",
				category: "Electronics",
				price: "$69.99",
				quantity: 1,
			},
			{
				id: "4-5",
				productName: "Webcam",
				category: "Electronics",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "4-6",
				productName: "Microphone",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "4-7",
				productName: "Headphones",
				category: "Electronics",
				price: "$129.99",
				quantity: 1,
			},
			{
				id: "4-8",
				productName: "USB Hub",
				category: "Electronics",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "4-9",
				productName: "Cable Organizer",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "4-10",
				productName: "Desk Mat",
				category: "Office",
				price: "$24.99",
				quantity: 1,
			},
		],
	},
	{
		id: "5",
		orderNumber: "SO-005",
		customer: "David Kim",
		customerEmail: "david@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		total: "$179.97",
		status: {
			label: "Pending",
			variant: "warning-light",
		},
		items: [
			{
				id: "5-1",
				productName: "Desk Lamp",
				category: "Home",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "5-2",
				productName: "Desk Organizer",
				category: "Home",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "5-3",
				productName: "Notebook Set",
				category: "Office",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "5-4",
				productName: "Pen Set",
				category: "Office",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "5-5",
				productName: "Stapler",
				category: "Office",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "5-6",
				productName: "Paper Clips",
				category: "Office",
				price: "$4.99",
				quantity: 1,
			},
			{
				id: "5-7",
				productName: "Binder",
				category: "Office",
				price: "$8.99",
				quantity: 1,
			},
			{
				id: "5-8",
				productName: "Highlighter",
				category: "Office",
				price: "$6.99",
				quantity: 1,
			},
			{
				id: "5-9",
				productName: "Eraser",
				category: "Office",
				price: "$2.99",
				quantity: 1,
			},
			{
				id: "5-10",
				productName: "Ruler",
				category: "Office",
				price: "$3.99",
				quantity: 1,
			},
			{
				id: "5-11",
				productName: "Calculator",
				category: "Office",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "5-12",
				productName: "Calendar",
				category: "Office",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "5-13",
				productName: "Whiteboard",
				category: "Office",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "5-14",
				productName: "Markers",
				category: "Office",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "5-15",
				productName: "Push Pins",
				category: "Office",
				price: "$5.99",
				quantity: 1,
			},
		],
	},
	{
		id: "6",
		orderNumber: "SO-006",
		customer: "Aron Thompson",
		customerEmail: "lisa@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
		total: "$329.95",
		status: {
			label: "Shipped",
			variant: "primary-light",
		},
		items: [
			{
				id: "6-1",
				productName: "Bluetooth Speaker",
				category: "Electronics",
				price: "$129.99",
				quantity: 1,
			},
			{
				id: "6-2",
				productName: "Phone Stand",
				category: "Accessories",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "6-3",
				productName: "Cable Management",
				category: "Accessories",
				price: "$19.99",
				quantity: 2,
			},
			{
				id: "6-4",
				productName: "Wireless Charger",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "6-5",
				productName: "Smart Watch",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "6-6",
				productName: "Fitness Band",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "6-7",
				productName: "Phone Case",
				category: "Accessories",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "6-8",
				productName: "Screen Protector",
				category: "Accessories",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "6-9",
				productName: "Car Mount",
				category: "Accessories",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "6-10",
				productName: "Power Bank",
				category: "Electronics",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "6-11",
				productName: "USB Cable",
				category: "Electronics",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "6-12",
				productName: "Adapter",
				category: "Electronics",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "6-13",
				productName: "Headphones",
				category: "Electronics",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "6-14",
				productName: "Earbuds",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "6-15",
				productName: "Microphone",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
		],
	},
	{
		id: "7",
		orderNumber: "SO-007",
		customer: "James Brown",
		customerEmail: "james@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
		total: "$159.96",
		status: {
			label: "Processing",
			variant: "info-light",
		},
		items: [
			{
				id: "7-1",
				productName: "Gaming Mouse",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "7-2",
				productName: "Gaming Keyboard",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "7-3",
				productName: "Mouse Pad",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "7-4",
				productName: "Gaming Headset",
				category: "Electronics",
				price: "$99.99",
				quantity: 1,
			},
			{
				id: "7-5",
				productName: "Gaming Chair",
				category: "Furniture",
				price: "$299.99",
				quantity: 1,
			},
			{
				id: "7-6",
				productName: "Gaming Desk",
				category: "Furniture",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "7-7",
				productName: "RGB Strip",
				category: "Electronics",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "7-8",
				productName: "Controller",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "7-9",
				productName: "Gaming Monitor",
				category: "Electronics",
				price: "$399.99",
				quantity: 1,
			},
			{
				id: "7-10",
				productName: "Graphics Card",
				category: "Electronics",
				price: "$599.99",
				quantity: 1,
			},
			{
				id: "7-11",
				productName: "RAM",
				category: "Electronics",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "7-12",
				productName: "SSD",
				category: "Electronics",
				price: "$129.99",
				quantity: 1,
			},
			{
				id: "7-13",
				productName: "CPU",
				category: "Electronics",
				price: "$299.99",
				quantity: 1,
			},
			{
				id: "7-14",
				productName: "Motherboard",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "7-15",
				productName: "Power Supply",
				category: "Electronics",
				price: "$149.99",
				quantity: 1,
			},
		],
	},
	{
		id: "8",
		orderNumber: "SO-008",
		customer: "Maria Garcia",
		customerEmail: "maria@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1620075225255-8c2051b6c015?w=96&h=96&dpr=2&q=80",
		total: "$89.97",
		status: {
			label: "Delivered",
			variant: "success-light",
		},
		items: [
			{
				id: "8-1",
				productName: "Yoga Mat",
				category: "Sports",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "8-2",
				productName: "Water Bottle",
				category: "Sports",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "8-3",
				productName: "Resistance Bands",
				category: "Sports",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "8-4",
				productName: "Dumbbells",
				category: "Sports",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "8-5",
				productName: "Kettlebell",
				category: "Sports",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "8-6",
				productName: "Jump Rope",
				category: "Sports",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "8-7",
				productName: "Foam Roller",
				category: "Sports",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "8-8",
				productName: "Exercise Ball",
				category: "Sports",
				price: "$34.99",
				quantity: 1,
			},
			{
				id: "8-9",
				productName: "Yoga Block",
				category: "Sports",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "8-10",
				productName: "Stretching Strap",
				category: "Sports",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "8-11",
				productName: "Gym Towel",
				category: "Sports",
				price: "$7.99",
				quantity: 1,
			},
			{
				id: "8-12",
				productName: "Sports Bra",
				category: "Clothing",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "8-13",
				productName: "Workout Shorts",
				category: "Clothing",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "8-14",
				productName: "Running Shoes",
				category: "Sports",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "8-15",
				productName: "Protein Shaker",
				category: "Sports",
				price: "$12.99",
				quantity: 1,
			},
		],
	},
	{
		id: "9",
		orderNumber: "SO-009",
		customer: "Nick Johnson",
		customerEmail: "nick@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1485206412256-701ccc5b93ca?w=96&h=96&dpr=2&q=80",
		total: "$199.98",
		status: {
			label: "Cancelled",
			variant: "destructive-light",
		},
		items: [
			{
				id: "9-1",
				productName: "Smart Watch",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "9-2",
				productName: "Watch Band",
				category: "Accessories",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "9-3",
				productName: "Charging Dock",
				category: "Electronics",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "9-4",
				productName: "Screen Protector",
				category: "Accessories",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "9-5",
				productName: "Case",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "9-6",
				productName: "Strap",
				category: "Accessories",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "9-7",
				productName: "Cable",
				category: "Electronics",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "9-8",
				productName: "Adapter",
				category: "Electronics",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "9-9",
				productName: "Mount",
				category: "Accessories",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "9-10",
				productName: "Stand",
				category: "Accessories",
				price: "$22.99",
				quantity: 1,
			},
			{
				id: "9-11",
				productName: "Cover",
				category: "Accessories",
				price: "$8.99",
				quantity: 1,
			},
			{
				id: "9-12",
				productName: "Grip",
				category: "Accessories",
				price: "$11.99",
				quantity: 1,
			},
			{
				id: "9-13",
				productName: "Lens",
				category: "Accessories",
				price: "$6.99",
				quantity: 1,
			},
			{
				id: "9-14",
				productName: "Filter",
				category: "Accessories",
				price: "$4.99",
				quantity: 1,
			},
			{
				id: "9-15",
				productName: "Cleaning Kit",
				category: "Accessories",
				price: "$7.99",
				quantity: 1,
			},
		],
	},
	{
		id: "10",
		orderNumber: "SO-010",
		customer: "Liam Thompson",
		customerEmail: "liam@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1542595913-85d69b0edbaf?w=96&h=96&dpr=2&q=80",
		total: "$149.97",
		status: {
			label: "Pending",
			variant: "warning-light",
		},
		items: [
			{
				id: "10-1",
				productName: "Kitchen Knife Set",
				category: "Home",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "10-2",
				productName: "Cutting Board",
				category: "Home",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "10-3",
				productName: "Utensil Set",
				category: "Home",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "10-4",
				productName: "Dish Towels",
				category: "Home",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "10-5",
				productName: "Pot Holders",
				category: "Home",
				price: "$8.99",
				quantity: 1,
			},
			{
				id: "10-6",
				productName: "Trivet",
				category: "Home",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "10-7",
				productName: "Measuring Cups",
				category: "Home",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "10-8",
				productName: "Measuring Spoons",
				category: "Home",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "10-9",
				productName: "Mixing Bowls",
				category: "Home",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "10-10",
				productName: "Spatula",
				category: "Home",
				price: "$6.99",
				quantity: 1,
			},
			{
				id: "10-11",
				productName: "Whisk",
				category: "Home",
				price: "$4.99",
				quantity: 1,
			},
			{
				id: "10-12",
				productName: "Ladle",
				category: "Home",
				price: "$7.99",
				quantity: 1,
			},
			{
				id: "10-13",
				productName: "Tongs",
				category: "Home",
				price: "$11.99",
				quantity: 1,
			},
			{
				id: "10-14",
				productName: "Can Opener",
				category: "Home",
				price: "$13.99",
				quantity: 1,
			},
			{
				id: "10-15",
				productName: "Bottle Opener",
				category: "Home",
				price: "$5.99",
				quantity: 1,
			},
		],
	},
	{
		id: "11",
		orderNumber: "SO-011",
		customer: "Alex Johnson",
		customerEmail: "alex@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
		total: "$279.96",
		status: {
			label: "Shipped",
			variant: "primary-outline",
		},
		items: [
			{
				id: "11-1",
				productName: "Office Chair",
				category: "Furniture",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "11-2",
				productName: "Desk Mat",
				category: "Office",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "11-3",
				productName: "Monitor Stand",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "11-4",
				productName: "Desk Lamp",
				category: "Office",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "11-5",
				productName: "Pen Holder",
				category: "Office",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "11-6",
				productName: "File Organizer",
				category: "Office",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "11-7",
				productName: "Stapler",
				category: "Office",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "11-8",
				productName: "Paper Clips",
				category: "Office",
				price: "$4.99",
				quantity: 1,
			},
			{
				id: "11-9",
				productName: "Binder",
				category: "Office",
				price: "$8.99",
				quantity: 1,
			},
			{
				id: "11-10",
				productName: "Highlighter",
				category: "Office",
				price: "$6.99",
				quantity: 1,
			},
			{
				id: "11-11",
				productName: "Eraser",
				category: "Office",
				price: "$2.99",
				quantity: 1,
			},
			{
				id: "11-12",
				productName: "Ruler",
				category: "Office",
				price: "$3.99",
				quantity: 1,
			},
			{
				id: "11-13",
				productName: "Calculator",
				category: "Office",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "11-14",
				productName: "Calendar",
				category: "Office",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "11-15",
				productName: "Whiteboard",
				category: "Office",
				price: "$24.99",
				quantity: 1,
			},
		],
	},
	{
		id: "12",
		orderNumber: "SO-012",
		customer: "Sarah Chen",
		customerEmail: "sarah@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
		total: "$119.97",
		status: {
			label: "Processing",
			variant: "info-light",
		},
		items: [
			{
				id: "12-1",
				productName: "Skincare Set",
				category: "Beauty",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "12-2",
				productName: "Face Mask",
				category: "Beauty",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "12-3",
				productName: "Moisturizer",
				category: "Beauty",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "12-4",
				productName: "Cleanser",
				category: "Beauty",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "12-5",
				productName: "Toner",
				category: "Beauty",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "12-6",
				productName: "Serum",
				category: "Beauty",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "12-7",
				productName: "Eye Cream",
				category: "Beauty",
				price: "$34.99",
				quantity: 1,
			},
			{
				id: "12-8",
				productName: "Sunscreen",
				category: "Beauty",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "12-9",
				productName: "Exfoliant",
				category: "Beauty",
				price: "$22.99",
				quantity: 1,
			},
			{
				id: "12-10",
				productName: "Lip Balm",
				category: "Beauty",
				price: "$7.99",
				quantity: 1,
			},
			{
				id: "12-11",
				productName: "Hand Cream",
				category: "Beauty",
				price: "$12.99",
				quantity: 1,
			},
			{
				id: "12-12",
				productName: "Body Lotion",
				category: "Beauty",
				price: "$18.99",
				quantity: 1,
			},
			{
				id: "12-13",
				productName: "Shampoo",
				category: "Beauty",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "12-14",
				productName: "Conditioner",
				category: "Beauty",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "12-15",
				productName: "Hair Mask",
				category: "Beauty",
				price: "$19.99",
				quantity: 1,
			},
		],
	},
	{
		id: "13",
		orderNumber: "SO-013",
		customer: "Michael Rodriguez",
		customerEmail: "michael@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
		total: "$89.98",
		status: {
			label: "Delivered",
			variant: "success-light",
		},
		items: [
			{
				id: "13-1",
				productName: "T-Shirt",
				category: "Clothing",
				price: "$19.99",
				quantity: 2,
			},
			{
				id: "13-2",
				productName: "Jeans",
				category: "Clothing",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "13-3",
				productName: "Hoodie",
				category: "Clothing",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "13-4",
				productName: "Sweater",
				category: "Clothing",
				price: "$34.99",
				quantity: 1,
			},
			{
				id: "13-5",
				productName: "Jacket",
				category: "Clothing",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "13-6",
				productName: "Shorts",
				category: "Clothing",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "13-7",
				productName: "Pants",
				category: "Clothing",
				price: "$44.99",
				quantity: 1,
			},
			{
				id: "13-8",
				productName: "Dress",
				category: "Clothing",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "13-9",
				productName: "Skirt",
				category: "Clothing",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "13-10",
				productName: "Blouse",
				category: "Clothing",
				price: "$34.99",
				quantity: 1,
			},
			{
				id: "13-11",
				productName: "Socks",
				category: "Clothing",
				price: "$9.99",
				quantity: 1,
			},
			{
				id: "13-12",
				productName: "Underwear",
				category: "Clothing",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "13-13",
				productName: "Hat",
				category: "Clothing",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "13-14",
				productName: "Scarf",
				category: "Clothing",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "13-15",
				productName: "Gloves",
				category: "Clothing",
				price: "$12.99",
				quantity: 1,
			},
		],
	},
	{
		id: "14",
		orderNumber: "SO-014",
		customer: "Emma Wilson",
		customerEmail: "emma@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
		total: "$199.97",
		status: {
			label: "Shipped",
			variant: "primary-light",
		},
		items: [
			{
				id: "14-1",
				productName: "Tablet",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "14-2",
				productName: "Tablet Case",
				category: "Accessories",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "14-3",
				productName: "Screen Protector",
				category: "Accessories",
				price: "$14.99",
				quantity: 1,
			},
			{
				id: "14-4",
				productName: "Stylus",
				category: "Accessories",
				price: "$39.99",
				quantity: 1,
			},
			{
				id: "14-5",
				productName: "Keyboard",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "14-6",
				productName: "Mouse",
				category: "Electronics",
				price: "$49.99",
				quantity: 1,
			},
			{
				id: "14-7",
				productName: "Charging Cable",
				category: "Electronics",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "14-8",
				productName: "Power Adapter",
				category: "Electronics",
				price: "$24.99",
				quantity: 1,
			},
			{
				id: "14-9",
				productName: "Stand",
				category: "Accessories",
				price: "$34.99",
				quantity: 1,
			},
			{
				id: "14-10",
				productName: "Mount",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "14-11",
				productName: "Cover",
				category: "Accessories",
				price: "$16.99",
				quantity: 1,
			},
			{
				id: "14-12",
				productName: "Grip",
				category: "Accessories",
				price: "$11.99",
				quantity: 1,
			},
			{
				id: "14-13",
				productName: "Lens",
				category: "Accessories",
				price: "$6.99",
				quantity: 1,
			},
			{
				id: "14-14",
				productName: "Filter",
				category: "Accessories",
				price: "$4.99",
				quantity: 1,
			},
			{
				id: "14-15",
				productName: "Cleaning Kit",
				category: "Accessories",
				price: "$7.99",
				quantity: 1,
			},
		],
	},
	{
		id: "15",
		orderNumber: "SO-015",
		customer: "David Kim",
		customerEmail: "david@example.com",
		customerAvatar: "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
		total: "$159.96",
		status: {
			label: "Pending",
			variant: "warning-light",
		},
		items: [
			{
				id: "15-1",
				productName: "Gaming Headset",
				category: "Electronics",
				price: "$99.99",
				quantity: 1,
			},
			{
				id: "15-2",
				productName: "Gaming Controller",
				category: "Electronics",
				price: "$59.99",
				quantity: 1,
			},
			{
				id: "15-3",
				productName: "Gaming Mouse",
				category: "Electronics",
				price: "$79.99",
				quantity: 1,
			},
			{
				id: "15-4",
				productName: "Gaming Keyboard",
				category: "Electronics",
				price: "$129.99",
				quantity: 1,
			},
			{
				id: "15-5",
				productName: "Gaming Chair",
				category: "Furniture",
				price: "$299.99",
				quantity: 1,
			},
			{
				id: "15-6",
				productName: "Gaming Desk",
				category: "Furniture",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "15-7",
				productName: "RGB Strip",
				category: "Electronics",
				price: "$29.99",
				quantity: 1,
			},
			{
				id: "15-8",
				productName: "Mouse Pad",
				category: "Accessories",
				price: "$19.99",
				quantity: 1,
			},
			{
				id: "15-9",
				productName: "Gaming Monitor",
				category: "Electronics",
				price: "$399.99",
				quantity: 1,
			},
			{
				id: "15-10",
				productName: "Graphics Card",
				category: "Electronics",
				price: "$599.99",
				quantity: 1,
			},
			{
				id: "15-11",
				productName: "RAM",
				category: "Electronics",
				price: "$89.99",
				quantity: 1,
			},
			{
				id: "15-12",
				productName: "SSD",
				category: "Electronics",
				price: "$129.99",
				quantity: 1,
			},
			{
				id: "15-13",
				productName: "CPU",
				category: "Electronics",
				price: "$299.99",
				quantity: 1,
			},
			{
				id: "15-14",
				productName: "Motherboard",
				category: "Electronics",
				price: "$199.99",
				quantity: 1,
			},
			{
				id: "15-15",
				productName: "Power Supply",
				category: "Electronics",
				price: "$149.99",
				quantity: 1,
			},
		],
	},
];

const PAGE_SIZE = 5;

type OrderItemCell = CellContext<DataGridFeatures, OrderItem>;
type OrderItemHeader = HeaderContext<DataGridFeatures, OrderItem>;
type OrderCell = CellContext<DataGridFeatures, Order>;
type OrderHeader = HeaderContext<DataGridFeatures, Order>;

function getOrderItemId(item: OrderItem): string {
	return item.id;
}

function getOrderId(order: Order): string {
	return order.id;
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((word: string): string => word.charAt(0))
		.join("");
}

// ── Sub-table: the items of one order ──────────────────────────────────────

function ProductHeader({ column }: OrderItemHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Product" column={column} />;
}

function CategoryHeader({ column }: OrderItemHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Category" column={column} />;
}

function PriceHeader({ column }: OrderItemHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Price" column={column} />;
}

function QuantityHeader({ column }: OrderItemHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Qty" column={column} />;
}

function ProductCell({ row }: OrderItemCell): React.JSX.Element {
	return <>{row.original.productName}</>;
}

function CategoryCell({ row }: OrderItemCell): React.JSX.Element {
	return <>{row.original.category}</>;
}

function PriceCell({ row }: OrderItemCell): React.JSX.Element {
	return <>{row.original.price}</>;
}

function QuantityCell({ row }: OrderItemCell): React.JSX.Element {
	return <>{row.original.quantity}</>;
}

const ITEM_COLUMNS: ColumnDef<DataGridFeatures, OrderItem>[] = [
	{ accessorKey: "productName", header: ProductHeader, cell: ProductCell, enableSorting: true, size: 200 },
	{ accessorKey: "category", header: CategoryHeader, cell: CategoryCell, enableSorting: true, size: 120 },
	{ accessorKey: "price", header: PriceHeader, cell: PriceCell, enableSorting: true, size: 100 },
	{ accessorKey: "quantity", header: QuantityHeader, cell: QuantityCell, enableSorting: true, size: 80 },
];

const ITEMS_TABLE_LAYOUT: DataGridTableLayout = { rowBorder: true };
const INITIAL_ITEMS_SORTING: SortingState = [];
const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: PAGE_SIZE };

interface OrderItemsSubTableProps {
	readonly items: readonly OrderItem[];
}

function OrderItemsSubTable({ items }: OrderItemsSubTableProps): React.JSX.Element {
	const [sorting, setSorting] = useState<SortingState>(INITIAL_ITEMS_SORTING);
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);

	const table = useTable({
		features: dataGridFeatures,
		data: items,
		columns: ITEM_COLUMNS,
		getRowId: getOrderItemId,
		state: { sorting, pagination },
		onSortingChange: setSorting,
		onPaginationChange: setPagination,
	});

	return (
		<div className="min-w-0 bg-background">
			<DataGrid table={table} recordCount={items.length} tableLayout={ITEMS_TABLE_LAYOUT}>
				<div className="w-full min-w-0 space-y-2.5 p-3 ps-12">
					<Card className="p-0">
						<DataGridContainer className="min-w-0">
							<DataGridScrollArea className="min-w-0">
								<DataGridTable />
							</DataGridScrollArea>
						</DataGridContainer>
					</Card>
					<DataGridPagination className="pb-1.5" />
				</div>
			</DataGrid>
		</div>
	);
}

function renderOrderItems(order: Order): React.ReactNode {
	return <OrderItemsSubTable items={order.items} />;
}

function hasOrderItems(row: Row<DataGridFeatures, Order>): boolean {
	return row.original.items.length > 0;
}

// ── Orders table ───────────────────────────────────────────────────────────

function EmptyHeader(): null {
	return null;
}

function CustomerHeader({ column }: OrderHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Customer" visibility column={column} />;
}

function ItemsHeader({ column }: OrderHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Items" visibility column={column} />;
}

function TotalHeader({ column }: OrderHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Total" visibility column={column} />;
}

function StatusHeader({ column }: OrderHeader): React.JSX.Element {
	return <DataGridColumnHeader title="Status" visibility column={column} />;
}

function ExpandCell({ row }: OrderCell): React.JSX.Element {
	return <DataGridTableRowExpand row={row} />;
}

function CustomerCell({ row }: OrderCell): React.JSX.Element {
	return (
		<div className="flex items-center gap-3">
			<Avatar className="size-8">
				<AvatarImage src={row.original.customerAvatar} alt={row.original.customer} />
				<AvatarFallback>{getInitials(row.original.customer)}</AvatarFallback>
			</Avatar>
			<div className="space-y-px">
				<div className="font-medium text-foreground">{row.original.customer}</div>
				<div className="text-muted-foreground">{row.original.customerEmail}</div>
			</div>
		</div>
	);
}

/** The item count doubles as an expand toggle for the order's items. */
function ItemsCell({ row }: OrderCell): React.JSX.Element {
	const itemCount = row.original.items.length;
	const handleClick = useCallback((): void => {
		row.toggleExpanded();
	}, [row]);
	return (
		<button type="button" onClick={handleClick} className="cursor-pointer text-sm font-medium text-foreground hover:text-primary">
			{String(itemCount)} {itemCount === 1 ? "item" : "items"}
		</button>
	);
}

function TotalCell({ row }: OrderCell): React.JSX.Element {
	return <>{row.original.total}</>;
}

function StatusCell({ row }: OrderCell): React.JSX.Element {
	return <Badge variant={row.original.status.variant}>{row.original.status.label}</Badge>;
}

function getOrderItemCount(order: Order): number {
	return order.items.length;
}

const ORDER_COLUMNS: ColumnDef<DataGridFeatures, Order>[] = [
	{ id: "expand", header: EmptyHeader, cell: ExpandCell, size: 25, enableResizing: false, meta: { expandedContent: renderOrderItems } },
	{ accessorKey: "customer", id: "customer", header: CustomerHeader, cell: CustomerCell, enableSorting: true, enableHiding: true, enableResizing: true, size: 200 },
	{ accessorFn: getOrderItemCount, id: "items", header: ItemsHeader, cell: ItemsCell, enableSorting: true, enableHiding: true, enableResizing: true, size: 120 },
	{ accessorKey: "total", id: "total", header: TotalHeader, cell: TotalCell, enableSorting: true, enableHiding: true, enableResizing: true, size: 100 },
	{ accessorKey: "status.label", id: "status", header: StatusHeader, cell: StatusCell, enableSorting: true, enableHiding: true, enableResizing: true, size: 120 },
];

const ORDERS_TABLE_LAYOUT: DataGridTableLayout = { columnsPinnable: true, columnsMovable: true, columnsVisibility: true };
const INITIAL_ORDERS_SORTING: SortingState = [];
const INITIAL_EXPANDED: ExpandedState = {};
const INITIAL_COLUMN_ORDER: ColumnOrderState = ["expand", "customer", "items", "total", "status"];

export function DataGrid9Example(): React.JSX.Element {
	const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
	const [sorting, setSorting] = useState<SortingState>(INITIAL_ORDERS_SORTING);
	const [expanded, setExpanded] = useState<ExpandedState>(INITIAL_EXPANDED);
	const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(INITIAL_COLUMN_ORDER);

	const table = useTable({
		features: dataGridFeatures,
		columns: ORDER_COLUMNS,
		data: ORDERS,
		getRowId: getOrderId,
		getRowCanExpand: hasOrderItems,
		state: { pagination, sorting, expanded, columnOrder },
		onPaginationChange: setPagination,
		onSortingChange: setSorting,
		onExpandedChange: setExpanded,
		onColumnOrderChange: setColumnOrder,
	});

	return (
		<DataGrid table={table} recordCount={ORDERS.length} tableLayout={ORDERS_TABLE_LAYOUT}>
			<div className="w-full space-y-2.5">
				<Card className="p-0">
					<DataGridContainer>
						<DataGridScrollArea>
							<DataGridTable />
						</DataGridScrollArea>
					</DataGridContainer>
				</Card>
				<DataGridPagination />
			</div>
		</DataGrid>
	);
}
