/**
 * 8 Standard Layout Templates extracted from the catalog shown on Home page.
 * Shared between server and client without external dependencies.
 */

export const STANDARD_TEMPLATES = [
  {
    "name": "Bold Type",
    "category": "Notice",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 108
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p1-badge",
        "kind": "text",
        "x": 60,
        "y": 175,
        "w": 960,
        "h": 36,
        "z": 1,
        "style": {
          "fontFamily": "Inter",
          "size": 22,
          "weight": 700,
          "color": "#F59E0B",
          "uppercase": true,
          "letterSpacing": 2
        },
        "text": "ANNUAL SYSTEM UPDATE"
      },
      {
        "id": "p1-title",
        "kind": "field",
        "field": "headline",
        "x": 60,
        "y": 225,
        "w": 960,
        "h": 220,
        "z": 2,
        "style": {
          "fontFamily": "Playfair Display",
          "size": 108,
          "weight": 700,
          "color": "#1E3A5F",
          "align": "left",
          "lineHeight": 1.05
        }
      },
      {
        "id": "p1-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#F59E0B",
          "stroke": "#F59E0B",
          "strokeWidth": 8
        },
        "x": 60,
        "y": 460,
        "w": 260,
        "h": 8,
        "z": 3
      },
      {
        "id": "p1-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 60,
        "y": 490,
        "w": 960,
        "h": 70,
        "z": 4,
        "style": {
          "fontFamily": "Inter",
          "size": 36,
          "weight": 500,
          "color": "#334155",
          "align": "left"
        }
      },
      {
        "id": "p1-details",
        "kind": "field",
        "field": "details",
        "x": 60,
        "y": 585,
        "w": 960,
        "h": 220,
        "z": 5,
        "style": {
          "fontFamily": "Inter",
          "size": 26,
          "minSize": 22,
          "weight": 400,
          "color": "#1E293B",
          "align": "left",
          "lineHeight": 1.4
        }
      },
      {
        "id": "p1-card-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#F8FAFC",
          "stroke": "#E2E8F0",
          "strokeWidth": 2
        },
        "x": 60,
        "y": 840,
        "w": 300,
        "h": 280,
        "z": 6,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p1-card-date-icon",
        "kind": "icon",
        "name": "calendar",
        "x": 90,
        "y": 870,
        "w": 44,
        "h": 44,
        "z": 7,
        "style": {
          "color": "#F59E0B"
        }
      },
      {
        "id": "p1-card-date-label",
        "kind": "text",
        "text": "DATE",
        "x": 90,
        "y": 930,
        "w": 240,
        "h": 30,
        "z": 8,
        "style": {
          "fontFamily": "Inter",
          "size": 22,
          "weight": 700,
          "color": "#64748B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p1-card-date-val",
        "kind": "field",
        "field": "date",
        "x": 90,
        "y": 975,
        "w": 240,
        "h": 90,
        "z": 9,
        "style": {
          "fontFamily": "Inter",
          "size": 36,
          "weight": 700,
          "color": "#1E3A5F"
        }
      },
      {
        "id": "p1-card-time-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#F8FAFC",
          "stroke": "#E2E8F0",
          "strokeWidth": 2
        },
        "x": 390,
        "y": 840,
        "w": 300,
        "h": 280,
        "z": 10,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p1-card-time-icon",
        "kind": "icon",
        "name": "clock",
        "x": 420,
        "y": 870,
        "w": 44,
        "h": 44,
        "z": 11,
        "style": {
          "color": "#F59E0B"
        }
      },
      {
        "id": "p1-card-time-label",
        "kind": "text",
        "text": "TIME",
        "x": 420,
        "y": 930,
        "w": 240,
        "h": 30,
        "z": 12,
        "style": {
          "fontFamily": "Inter",
          "size": 22,
          "weight": 700,
          "color": "#64748B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p1-card-time-val",
        "kind": "field",
        "field": "time",
        "x": 420,
        "y": 975,
        "w": 240,
        "h": 90,
        "z": 13,
        "style": {
          "fontFamily": "Inter",
          "size": 36,
          "weight": 700,
          "color": "#1E3A5F"
        }
      },
      {
        "id": "p1-card-venue-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#F8FAFC",
          "stroke": "#E2E8F0",
          "strokeWidth": 2
        },
        "x": 720,
        "y": 840,
        "w": 300,
        "h": 280,
        "z": 14,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p1-card-venue-icon",
        "kind": "icon",
        "name": "map-pin",
        "x": 750,
        "y": 870,
        "w": 44,
        "h": 44,
        "z": 15,
        "style": {
          "color": "#F59E0B"
        }
      },
      {
        "id": "p1-card-venue-label",
        "kind": "text",
        "text": "VENUE",
        "x": 750,
        "y": 930,
        "w": 240,
        "h": 30,
        "z": 16,
        "style": {
          "fontFamily": "Inter",
          "size": 22,
          "weight": 700,
          "color": "#64748B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p1-card-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 750,
        "y": 975,
        "w": 240,
        "h": 90,
        "z": 17,
        "style": {
          "fontFamily": "Inter",
          "size": 34,
          "weight": 700,
          "color": "#1E3A5F"
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": true,
    "version": 1,
    "versions": []
  },
  {
    "name": "Photo Hero",
    "category": "Awareness",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 96
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p2-photo",
        "kind": "image",
        "field": "photo",
        "x": 60,
        "y": 165,
        "w": 960,
        "h": 375,
        "z": 1,
        "style": {
          "fill": "#FEE2E2",
          "radius": 16,
          "color": "#B91C1C"
        },
        "name": "heart-pulse"
      },
      {
        "id": "p2-band",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#B91C1C"
        },
        "x": 60,
        "y": 565,
        "w": 960,
        "h": 140,
        "z": 2,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p2-title",
        "kind": "field",
        "field": "headline",
        "x": 80,
        "y": 585,
        "w": 920,
        "h": 105,
        "z": 3,
        "style": {
          "fontFamily": "Poppins",
          "size": 96,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p2-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 60,
        "y": 725,
        "w": 960,
        "h": 60,
        "z": 4,
        "style": {
          "fontFamily": "Poppins",
          "size": 34,
          "weight": 600,
          "color": "#7F1D1D",
          "align": "center"
        }
      },
      {
        "id": "p2-details",
        "kind": "field",
        "field": "details",
        "x": 100,
        "y": 800,
        "w": 880,
        "h": 170,
        "z": 5,
        "style": {
          "fontFamily": "Poppins",
          "size": 26,
          "minSize": 22,
          "weight": 400,
          "color": "#1C1917",
          "align": "left",
          "lineHeight": 1.4
        }
      },
      {
        "id": "p2-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#FECACA",
          "strokeWidth": 2
        },
        "x": 60,
        "y": 990,
        "w": 300,
        "h": 160,
        "z": 6,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p2-date-icon",
        "kind": "icon",
        "name": "calendar",
        "x": 85,
        "y": 1010,
        "w": 38,
        "h": 38,
        "z": 7,
        "style": {
          "color": "#B91C1C"
        }
      },
      {
        "id": "p2-date-label",
        "kind": "text",
        "text": "DATE",
        "x": 135,
        "y": 1015,
        "w": 200,
        "h": 30,
        "z": 8,
        "style": {
          "fontFamily": "Poppins",
          "size": 22,
          "weight": 700,
          "color": "#991B1B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p2-date-val",
        "kind": "field",
        "field": "date",
        "x": 85,
        "y": 1060,
        "w": 255,
        "h": 70,
        "z": 9,
        "style": {
          "fontFamily": "Poppins",
          "size": 34,
          "weight": 700,
          "color": "#1C1917"
        }
      },
      {
        "id": "p2-time-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#FECACA",
          "strokeWidth": 2
        },
        "x": 390,
        "y": 990,
        "w": 300,
        "h": 160,
        "z": 10,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p2-time-icon",
        "kind": "icon",
        "name": "clock",
        "x": 415,
        "y": 1010,
        "w": 38,
        "h": 38,
        "z": 11,
        "style": {
          "color": "#B91C1C"
        }
      },
      {
        "id": "p2-time-label",
        "kind": "text",
        "text": "TIME",
        "x": 465,
        "y": 1015,
        "w": 200,
        "h": 30,
        "z": 12,
        "style": {
          "fontFamily": "Poppins",
          "size": 22,
          "weight": 700,
          "color": "#991B1B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p2-time-val",
        "kind": "field",
        "field": "time",
        "x": 415,
        "y": 1060,
        "w": 255,
        "h": 70,
        "z": 13,
        "style": {
          "fontFamily": "Poppins",
          "size": 34,
          "weight": 700,
          "color": "#1C1917"
        }
      },
      {
        "id": "p2-venue-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#FECACA",
          "strokeWidth": 2
        },
        "x": 720,
        "y": 990,
        "w": 300,
        "h": 160,
        "z": 14,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p2-venue-icon",
        "kind": "icon",
        "name": "map-pin",
        "x": 745,
        "y": 1010,
        "w": 38,
        "h": 38,
        "z": 15,
        "style": {
          "color": "#B91C1C"
        }
      },
      {
        "id": "p2-venue-label",
        "kind": "text",
        "text": "VENUE",
        "x": 795,
        "y": 1015,
        "w": 200,
        "h": 30,
        "z": 16,
        "style": {
          "fontFamily": "Poppins",
          "size": 22,
          "weight": 700,
          "color": "#991B1B",
          "uppercase": true,
          "letterSpacing": 1
        }
      },
      {
        "id": "p2-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 745,
        "y": 1060,
        "w": 255,
        "h": 70,
        "z": 17,
        "style": {
          "fontFamily": "Poppins",
          "size": 32,
          "weight": 700,
          "color": "#1C1917"
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Date Block",
    "category": "Event",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 140
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p3-left-panel",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#EA580C"
        },
        "x": 60,
        "y": 170,
        "w": 280,
        "h": 970,
        "z": 1,
        "style": {
          "radius": 20
        }
      },
      {
        "id": "p3-left-icon",
        "kind": "icon",
        "name": "trophy",
        "x": 160,
        "y": 215,
        "w": 80,
        "h": 80,
        "z": 2,
        "style": {
          "color": "#FFFFFF"
        }
      },
      {
        "id": "p3-left-day",
        "kind": "text",
        "text": "18",
        "x": 70,
        "y": 310,
        "w": 260,
        "h": 155,
        "z": 3,
        "style": {
          "fontFamily": "Anton",
          "size": 140,
          "weight": 400,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p3-left-month",
        "kind": "text",
        "text": "OCTOBER",
        "x": 70,
        "y": 475,
        "w": 260,
        "h": 60,
        "z": 4,
        "style": {
          "fontFamily": "Anton",
          "size": 44,
          "weight": 400,
          "color": "#FFEDD5",
          "align": "center",
          "letterSpacing": 2
        }
      },
      {
        "id": "p3-left-line",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#FDBA74",
          "stroke": "#FDBA74",
          "strokeWidth": 3
        },
        "x": 90,
        "y": 560,
        "w": 220,
        "h": 3,
        "z": 5
      },
      {
        "id": "p3-left-time-label",
        "kind": "text",
        "text": "HOURS",
        "x": 70,
        "y": 585,
        "w": 260,
        "h": 30,
        "z": 6,
        "style": {
          "fontFamily": "Roboto",
          "size": 22,
          "weight": 700,
          "color": "#FFEDD5",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p3-left-time-val",
        "kind": "field",
        "field": "time",
        "x": 70,
        "y": 625,
        "w": 260,
        "h": 60,
        "z": 7,
        "style": {
          "fontFamily": "Anton",
          "size": 34,
          "weight": 400,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p3-left-venue-label",
        "kind": "text",
        "text": "GROUNDS",
        "x": 70,
        "y": 705,
        "w": 260,
        "h": 30,
        "z": 8,
        "style": {
          "fontFamily": "Roboto",
          "size": 22,
          "weight": 700,
          "color": "#FFEDD5",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p3-left-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 70,
        "y": 745,
        "w": 260,
        "h": 90,
        "z": 9,
        "style": {
          "fontFamily": "Roboto",
          "size": 28,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p3-left-flag-icon",
        "kind": "icon",
        "name": "flag",
        "x": 175,
        "y": 865,
        "w": 50,
        "h": 50,
        "z": 10,
        "style": {
          "color": "#FFFFFF"
        }
      },
      {
        "id": "p3-right-overline",
        "kind": "text",
        "text": "INTER-HOUSE ATHLETICS",
        "x": 370,
        "y": 180,
        "w": 650,
        "h": 35,
        "z": 11,
        "style": {
          "fontFamily": "Roboto",
          "size": 24,
          "weight": 700,
          "color": "#EA580C",
          "letterSpacing": 2,
          "uppercase": true
        }
      },
      {
        "id": "p3-right-title",
        "kind": "field",
        "field": "headline",
        "x": 370,
        "y": 225,
        "w": 650,
        "h": 220,
        "z": 12,
        "style": {
          "fontFamily": "Anton",
          "size": 104,
          "weight": 400,
          "color": "#1F2937",
          "align": "left",
          "lineHeight": 1.05
        }
      },
      {
        "id": "p3-right-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 370,
        "y": 460,
        "w": 650,
        "h": 60,
        "z": 13,
        "style": {
          "fontFamily": "Roboto",
          "size": 36,
          "weight": 500,
          "color": "#EA580C",
          "align": "left"
        }
      },
      {
        "id": "p3-right-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#E5E7EB",
          "stroke": "#E5E7EB",
          "strokeWidth": 3
        },
        "x": 370,
        "y": 535,
        "w": 650,
        "h": 3,
        "z": 14
      },
      {
        "id": "p3-right-details",
        "kind": "field",
        "field": "details",
        "x": 370,
        "y": 560,
        "w": 650,
        "h": 240,
        "z": 15,
        "style": {
          "fontFamily": "Roboto",
          "size": 26,
          "minSize": 22,
          "weight": 400,
          "color": "#374151",
          "align": "left",
          "lineHeight": 1.5
        }
      },
      {
        "id": "p3-right-cta-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#1F2937"
        },
        "x": 370,
        "y": 840,
        "w": 650,
        "h": 100,
        "z": 16,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p3-right-cta-text",
        "kind": "text",
        "text": "COME CHEER YOUR HOUSE TEAMS",
        "x": 390,
        "y": 865,
        "w": 610,
        "h": 50,
        "z": 17,
        "style": {
          "fontFamily": "Anton",
          "size": 34,
          "weight": 400,
          "color": "#FFFFFF",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p3-right-cta-sub",
        "kind": "text",
        "text": "Admission free for all families and alumni",
        "x": 370,
        "y": 960,
        "w": 650,
        "h": 40,
        "z": 18,
        "style": {
          "fontFamily": "Roboto",
          "size": 22,
          "weight": 500,
          "color": "#6B7280",
          "align": "center"
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Ticket",
    "category": "Festival",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 98
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p4-ticket-outer",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#2A1208",
          "stroke": "#F59E0B",
          "strokeWidth": 3
        },
        "x": 60,
        "y": 165,
        "w": 960,
        "h": 980,
        "z": 1,
        "style": {
          "radius": 24
        }
      },
      {
        "id": "p4-notch-left",
        "kind": "shape",
        "shape": {
          "type": "circle",
          "fill": "#1C0F0A",
          "stroke": "#F59E0B",
          "strokeWidth": 3
        },
        "x": 35,
        "y": 760,
        "w": 50,
        "h": 50,
        "z": 2
      },
      {
        "id": "p4-notch-right",
        "kind": "shape",
        "shape": {
          "type": "circle",
          "fill": "#1C0F0A",
          "stroke": "#F59E0B",
          "strokeWidth": 3
        },
        "x": 995,
        "y": 760,
        "w": 50,
        "h": 50,
        "z": 3
      },
      {
        "id": "p4-icon",
        "kind": "icon",
        "name": "sparkles",
        "x": 500,
        "y": 195,
        "w": 80,
        "h": 80,
        "z": 4,
        "style": {
          "color": "#F59E0B"
        }
      },
      {
        "id": "p4-overline",
        "kind": "text",
        "text": "FESTIVAL OF LIGHTS CELEBRATION",
        "x": 80,
        "y": 285,
        "w": 920,
        "h": 36,
        "z": 5,
        "style": {
          "fontFamily": "Lato",
          "size": 22,
          "weight": 700,
          "color": "#FDE68A",
          "align": "center",
          "letterSpacing": 3,
          "uppercase": true
        }
      },
      {
        "id": "p4-title",
        "kind": "field",
        "field": "headline",
        "x": 80,
        "y": 325,
        "w": 920,
        "h": 200,
        "z": 6,
        "style": {
          "fontFamily": "Cinzel",
          "size": 98,
          "weight": 700,
          "color": "#F59E0B",
          "align": "center",
          "lineHeight": 1.1
        }
      },
      {
        "id": "p4-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 80,
        "y": 535,
        "w": 920,
        "h": 60,
        "z": 7,
        "style": {
          "fontFamily": "Lato",
          "size": 34,
          "weight": 400,
          "color": "#FEF3C7",
          "align": "center"
        }
      },
      {
        "id": "p4-details",
        "kind": "field",
        "field": "details",
        "x": 120,
        "y": 605,
        "w": 840,
        "h": 140,
        "z": 8,
        "style": {
          "fontFamily": "Lato",
          "size": 24,
          "minSize": 22,
          "weight": 400,
          "color": "#FDE68A",
          "align": "left",
          "lineHeight": 1.4
        }
      },
      {
        "id": "p4-divider",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#F59E0B",
          "stroke": "#F59E0B",
          "strokeWidth": 4
        },
        "x": 90,
        "y": 785,
        "w": 900,
        "h": 4,
        "z": 9
      },
      {
        "id": "p4-stub-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#3B170B",
          "stroke": "#B45309",
          "strokeWidth": 2
        },
        "x": 90,
        "y": 820,
        "w": 270,
        "h": 180,
        "z": 10,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p4-stub-date-label",
        "kind": "text",
        "text": "DATE",
        "x": 100,
        "y": 840,
        "w": 250,
        "h": 30,
        "z": 11,
        "style": {
          "fontFamily": "Lato",
          "size": 22,
          "weight": 700,
          "color": "#FCD34D",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p4-stub-date-val",
        "kind": "field",
        "field": "date",
        "x": 100,
        "y": 885,
        "w": 250,
        "h": 70,
        "z": 12,
        "style": {
          "fontFamily": "Cinzel",
          "size": 36,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p4-stub-time-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#3B170B",
          "stroke": "#B45309",
          "strokeWidth": 2
        },
        "x": 395,
        "y": 820,
        "w": 290,
        "h": 180,
        "z": 13,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p4-stub-time-label",
        "kind": "text",
        "text": "HOURS",
        "x": 405,
        "y": 840,
        "w": 270,
        "h": 30,
        "z": 14,
        "style": {
          "fontFamily": "Lato",
          "size": 22,
          "weight": 700,
          "color": "#FCD34D",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p4-stub-time-val",
        "kind": "field",
        "field": "time",
        "x": 405,
        "y": 885,
        "w": 270,
        "h": 70,
        "z": 15,
        "style": {
          "fontFamily": "Cinzel",
          "size": 34,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p4-stub-venue-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#3B170B",
          "stroke": "#B45309",
          "strokeWidth": 2
        },
        "x": 715,
        "y": 820,
        "w": 275,
        "h": 180,
        "z": 16,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p4-stub-venue-label",
        "kind": "text",
        "text": "ADMISSION",
        "x": 725,
        "y": 840,
        "w": 255,
        "h": 30,
        "z": 17,
        "style": {
          "fontFamily": "Lato",
          "size": 22,
          "weight": 700,
          "color": "#FCD34D",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p4-stub-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 725,
        "y": 885,
        "w": 255,
        "h": 70,
        "z": 18,
        "style": {
          "fontFamily": "Lato",
          "size": 32,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p4-stub-footer",
        "kind": "text",
        "text": "FREE COMMUNITY EVENT · ALL ARE WELCOME",
        "x": 90,
        "y": 1030,
        "w": 900,
        "h": 40,
        "z": 19,
        "style": {
          "fontFamily": "Cinzel",
          "size": 22,
          "weight": 700,
          "color": "#F59E0B",
          "align": "center",
          "letterSpacing": 2
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Centered Award",
    "category": "Achievement",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 108
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p5-frame-outer",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "transparent",
          "stroke": "#CA8A04",
          "strokeWidth": 3
        },
        "x": 60,
        "y": 165,
        "w": 960,
        "h": 980,
        "z": 1,
        "style": {
          "radius": 4
        }
      },
      {
        "id": "p5-frame-inner",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "transparent",
          "stroke": "#CA8A04",
          "strokeWidth": 1
        },
        "x": 74,
        "y": 179,
        "w": 932,
        "h": 952,
        "z": 2,
        "style": {
          "radius": 2
        }
      },
      {
        "id": "p5-badge-circle",
        "kind": "shape",
        "shape": {
          "type": "circle",
          "fill": "#1E1B10",
          "stroke": "#CA8A04",
          "strokeWidth": 3
        },
        "x": 470,
        "y": 210,
        "w": 140,
        "h": 140,
        "z": 3
      },
      {
        "id": "p5-badge-icon",
        "kind": "icon",
        "name": "award",
        "x": 505,
        "y": 245,
        "w": 70,
        "h": 70,
        "z": 4,
        "style": {
          "color": "#CA8A04"
        }
      },
      {
        "id": "p5-overline",
        "kind": "text",
        "text": "ANNUAL EXCELLENCE CEREMONY",
        "x": 90,
        "y": 375,
        "w": 900,
        "h": 35,
        "z": 5,
        "style": {
          "fontFamily": "Montserrat",
          "size": 24,
          "weight": 600,
          "color": "#CA8A04",
          "align": "center",
          "letterSpacing": 4,
          "uppercase": true
        }
      },
      {
        "id": "p5-title",
        "kind": "field",
        "field": "headline",
        "x": 90,
        "y": 420,
        "w": 900,
        "h": 200,
        "z": 6,
        "style": {
          "fontFamily": "Cormorant Garamond",
          "size": 108,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center",
          "lineHeight": 1.05
        }
      },
      {
        "id": "p5-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#CA8A04",
          "stroke": "#CA8A04",
          "strokeWidth": 2
        },
        "x": 340,
        "y": 635,
        "w": 400,
        "h": 2,
        "z": 7
      },
      {
        "id": "p5-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 90,
        "y": 655,
        "w": 900,
        "h": 60,
        "z": 8,
        "style": {
          "fontFamily": "Montserrat",
          "size": 32,
          "weight": 400,
          "color": "#E5E7EB",
          "align": "center"
        }
      },
      {
        "id": "p5-details",
        "kind": "field",
        "field": "details",
        "x": 160,
        "y": 730,
        "w": 760,
        "h": 160,
        "z": 9,
        "style": {
          "fontFamily": "Montserrat",
          "size": 24,
          "minSize": 22,
          "weight": 400,
          "color": "#9CA3AF",
          "align": "center",
          "lineHeight": 1.5
        }
      },
      {
        "id": "p5-card-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#161D2F",
          "stroke": "#854D0E",
          "strokeWidth": 2
        },
        "x": 90,
        "y": 915,
        "w": 270,
        "h": 185,
        "z": 10,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p5-card-date-label",
        "kind": "text",
        "text": "DATE",
        "x": 100,
        "y": 935,
        "w": 250,
        "h": 30,
        "z": 11,
        "style": {
          "fontFamily": "Montserrat",
          "size": 22,
          "weight": 600,
          "color": "#CA8A04",
          "align": "center",
          "letterSpacing": 2
        }
      },
      {
        "id": "p5-card-date-val",
        "kind": "field",
        "field": "date",
        "x": 100,
        "y": 980,
        "w": 250,
        "h": 70,
        "z": 12,
        "style": {
          "fontFamily": "Cormorant Garamond",
          "size": 36,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p5-card-time-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#161D2F",
          "stroke": "#854D0E",
          "strokeWidth": 2
        },
        "x": 405,
        "y": 915,
        "w": 270,
        "h": 185,
        "z": 13,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p5-card-time-label",
        "kind": "text",
        "text": "TIME",
        "x": 415,
        "y": 935,
        "w": 250,
        "h": 30,
        "z": 14,
        "style": {
          "fontFamily": "Montserrat",
          "size": 22,
          "weight": 600,
          "color": "#CA8A04",
          "align": "center",
          "letterSpacing": 2
        }
      },
      {
        "id": "p5-card-time-val",
        "kind": "field",
        "field": "time",
        "x": 415,
        "y": 980,
        "w": 250,
        "h": 70,
        "z": 15,
        "style": {
          "fontFamily": "Cormorant Garamond",
          "size": 36,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center"
        }
      },
      {
        "id": "p5-card-venue-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#161D2F",
          "stroke": "#854D0E",
          "strokeWidth": 2
        },
        "x": 720,
        "y": 915,
        "w": 270,
        "h": 185,
        "z": 16,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p5-card-venue-label",
        "kind": "text",
        "text": "VENUE",
        "x": 730,
        "y": 935,
        "w": 250,
        "h": 30,
        "z": 17,
        "style": {
          "fontFamily": "Montserrat",
          "size": 22,
          "weight": 600,
          "color": "#CA8A04",
          "align": "center",
          "letterSpacing": 2
        }
      },
      {
        "id": "p5-card-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 730,
        "y": 980,
        "w": 250,
        "h": 70,
        "z": 18,
        "style": {
          "fontFamily": "Montserrat",
          "size": 32,
          "weight": 600,
          "color": "#FFFFFF",
          "align": "center"
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Agenda",
    "category": "Event",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 20,
        "maxFont": 96
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p6-kicker",
        "kind": "text",
        "text": "HANDS-ON DEVELOPER SESSIONS",
        "x": 60,
        "y": 165,
        "w": 960,
        "h": 32,
        "z": 1,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "weight": 600,
          "color": "#0F766E",
          "letterSpacing": 2,
          "uppercase": true
        }
      },
      {
        "id": "p6-title",
        "kind": "field",
        "field": "headline",
        "x": 60,
        "y": 205,
        "w": 960,
        "h": 140,
        "z": 2,
        "style": {
          "fontFamily": "Space Grotesk",
          "size": 96,
          "weight": 700,
          "color": "#0F766E",
          "align": "left",
          "lineHeight": 1.1
        }
      },
      {
        "id": "p6-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 60,
        "y": 355,
        "w": 960,
        "h": 50,
        "z": 3,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 32,
          "weight": 500,
          "color": "#134E4A",
          "align": "left"
        }
      },
      {
        "id": "p6-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#99F6E4",
          "stroke": "#99F6E4",
          "strokeWidth": 3
        },
        "x": 60,
        "y": 415,
        "w": 960,
        "h": 3,
        "z": 4
      },
      {
        "id": "p6-sched-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#CCFBF1",
          "strokeWidth": 2
        },
        "x": 60,
        "y": 440,
        "w": 460,
        "h": 520,
        "z": 5,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p6-sched-title",
        "kind": "text",
        "text": "WORKSHOP SCHEDULE",
        "x": 80,
        "y": 465,
        "w": 420,
        "h": 30,
        "z": 6,
        "style": {
          "fontFamily": "Space Grotesk",
          "size": 24,
          "weight": 700,
          "color": "#0F766E",
          "letterSpacing": 1
        }
      },
      {
        "id": "p6-slot-1",
        "kind": "text",
        "text": "09:00 AM · Setup & Syntax Basics",
        "x": 80,
        "y": 515,
        "w": 420,
        "h": 40,
        "z": 7,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "weight": 600,
          "color": "#134E4A"
        }
      },
      {
        "id": "p6-slot-2",
        "kind": "text",
        "text": "10:30 AM · Logic & Components",
        "x": 80,
        "y": 625,
        "w": 420,
        "h": 40,
        "z": 8,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "weight": 600,
          "color": "#134E4A"
        }
      },
      {
        "id": "p6-slot-3",
        "kind": "text",
        "text": "01:00 PM · Working with Live APIs",
        "x": 80,
        "y": 735,
        "w": 420,
        "h": 40,
        "z": 9,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "weight": 600,
          "color": "#134E4A"
        }
      },
      {
        "id": "p6-slot-4",
        "kind": "text",
        "text": "02:30 PM · Project Demo & Review",
        "x": 80,
        "y": 845,
        "w": 420,
        "h": 40,
        "z": 10,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "weight": 600,
          "color": "#134E4A"
        }
      },
      {
        "id": "p6-info-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#CCFBF1",
          "stroke": "#14B8A6",
          "strokeWidth": 2
        },
        "x": 550,
        "y": 440,
        "w": 470,
        "h": 520,
        "z": 11,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p6-date-label",
        "kind": "text",
        "text": "DATE & TIME",
        "x": 580,
        "y": 470,
        "w": 410,
        "h": 26,
        "z": 12,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 20,
          "weight": 700,
          "color": "#0F766E"
        }
      },
      {
        "id": "p6-date-val",
        "kind": "field",
        "field": "date",
        "x": 580,
        "y": 500,
        "w": 410,
        "h": 40,
        "z": 13,
        "style": {
          "fontFamily": "Space Grotesk",
          "size": 32,
          "weight": 700,
          "color": "#0F172A"
        }
      },
      {
        "id": "p6-venue-label",
        "kind": "text",
        "text": "SESSION LAB",
        "x": 580,
        "y": 560,
        "w": 410,
        "h": 26,
        "z": 14,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 20,
          "weight": 700,
          "color": "#0F766E"
        }
      },
      {
        "id": "p6-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 580,
        "y": 590,
        "w": 410,
        "h": 40,
        "z": 15,
        "style": {
          "fontFamily": "Space Grotesk",
          "size": 32,
          "weight": 700,
          "color": "#0F172A"
        }
      },
      {
        "id": "p6-details",
        "kind": "field",
        "field": "details",
        "x": 580,
        "y": 650,
        "w": 410,
        "h": 280,
        "z": 16,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 22,
          "minSize": 20,
          "weight": 500,
          "color": "#134E4A",
          "lineHeight": 1.4
        }
      },
      {
        "id": "p6-cta-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#0F766E"
        },
        "x": 60,
        "y": 990,
        "w": 960,
        "h": 120,
        "z": 17,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p6-cta-text",
        "kind": "text",
        "text": "REGISTER FREE AT TECHHUB.EDU/CODE",
        "x": 80,
        "y": 1030,
        "w": 920,
        "h": 45,
        "z": 18,
        "style": {
          "fontFamily": "IBM Plex Mono",
          "size": 32,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center",
          "letterSpacing": 2
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Notice",
    "category": "Notice",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 98
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p7-border-outer",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#1D4ED8",
          "strokeWidth": 4
        },
        "x": 60,
        "y": 165,
        "w": 960,
        "h": 980,
        "z": 1,
        "style": {
          "radius": 8
        }
      },
      {
        "id": "p7-border-inner",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "transparent",
          "stroke": "#93C5FD",
          "strokeWidth": 1
        },
        "x": 74,
        "y": 179,
        "w": 932,
        "h": 952,
        "z": 2,
        "style": {
          "radius": 4
        }
      },
      {
        "id": "p7-notice-band",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#1D4ED8"
        },
        "x": 100,
        "y": 205,
        "w": 880,
        "h": 70,
        "z": 3,
        "style": {
          "radius": 6
        }
      },
      {
        "id": "p7-notice-text",
        "kind": "text",
        "text": "OFFICIAL ADMINISTRATIVE NOTICE",
        "x": 100,
        "y": 222,
        "w": 880,
        "h": 40,
        "z": 4,
        "style": {
          "fontFamily": "Merriweather",
          "size": 32,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center",
          "letterSpacing": 3
        }
      },
      {
        "id": "p7-title",
        "kind": "field",
        "field": "headline",
        "x": 100,
        "y": 300,
        "w": 880,
        "h": 140,
        "z": 5,
        "style": {
          "fontFamily": "Merriweather",
          "size": 98,
          "weight": 700,
          "color": "#1D4ED8",
          "align": "center",
          "lineHeight": 1.1
        }
      },
      {
        "id": "p7-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 100,
        "y": 450,
        "w": 880,
        "h": 50,
        "z": 6,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 34,
          "weight": 600,
          "color": "#475569",
          "align": "center"
        }
      },
      {
        "id": "p7-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#CBD5E1",
          "stroke": "#CBD5E1",
          "strokeWidth": 2
        },
        "x": 240,
        "y": 515,
        "w": 600,
        "h": 2,
        "z": 7
      },
      {
        "id": "p7-point-1",
        "kind": "text",
        "text": "1. Campus closed for autumn break",
        "x": 120,
        "y": 540,
        "w": 840,
        "h": 45,
        "z": 8,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 28,
          "weight": 600,
          "color": "#1E293B"
        }
      },
      {
        "id": "p7-point-2",
        "kind": "text",
        "text": "2. Administrative desk open morning hours",
        "x": 120,
        "y": 605,
        "w": 840,
        "h": 45,
        "z": 9,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 28,
          "weight": 600,
          "color": "#1E293B"
        }
      },
      {
        "id": "p7-point-3",
        "kind": "text",
        "text": "3. Classes resume next Monday sharp",
        "x": 120,
        "y": 670,
        "w": 840,
        "h": 45,
        "z": 10,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 28,
          "weight": 600,
          "color": "#1E293B"
        }
      },
      {
        "id": "p7-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#EFF6FF",
          "stroke": "#BFDBFE",
          "strokeWidth": 2
        },
        "x": 100,
        "y": 745,
        "w": 270,
        "h": 160,
        "z": 11,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p7-date-label",
        "kind": "text",
        "text": "DATES",
        "x": 110,
        "y": 765,
        "w": 250,
        "h": 30,
        "z": 12,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 22,
          "weight": 700,
          "color": "#1D4ED8",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p7-date-val",
        "kind": "field",
        "field": "date",
        "x": 110,
        "y": 810,
        "w": 250,
        "h": 70,
        "z": 13,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 34,
          "weight": 700,
          "color": "#1E293B",
          "align": "center"
        }
      },
      {
        "id": "p7-time-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#EFF6FF",
          "stroke": "#BFDBFE",
          "strokeWidth": 2
        },
        "x": 405,
        "y": 745,
        "w": 270,
        "h": 160,
        "z": 14,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p7-time-label",
        "kind": "text",
        "text": "PERIOD",
        "x": 415,
        "y": 765,
        "w": 250,
        "h": 30,
        "z": 15,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 22,
          "weight": 700,
          "color": "#1D4ED8",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p7-time-val",
        "kind": "field",
        "field": "time",
        "x": 415,
        "y": 810,
        "w": 250,
        "h": 70,
        "z": 16,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 34,
          "weight": 700,
          "color": "#1E293B",
          "align": "center"
        }
      },
      {
        "id": "p7-venue-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#EFF6FF",
          "stroke": "#BFDBFE",
          "strokeWidth": 2
        },
        "x": 710,
        "y": 745,
        "w": 270,
        "h": 160,
        "z": 17,
        "style": {
          "radius": 12
        }
      },
      {
        "id": "p7-venue-label",
        "kind": "text",
        "text": "CAMPUS",
        "x": 720,
        "y": 765,
        "w": 250,
        "h": 30,
        "z": 18,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 22,
          "weight": 700,
          "color": "#1D4ED8",
          "align": "center",
          "letterSpacing": 1
        }
      },
      {
        "id": "p7-venue-val",
        "kind": "field",
        "field": "venue",
        "x": 720,
        "y": 810,
        "w": 250,
        "h": 70,
        "z": 19,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 32,
          "weight": 700,
          "color": "#1E293B",
          "align": "center"
        }
      },
      {
        "id": "p7-sig-line",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#1D4ED8",
          "stroke": "#1D4ED8",
          "strokeWidth": 2
        },
        "x": 640,
        "y": 970,
        "w": 340,
        "h": 2,
        "z": 20
      },
      {
        "id": "p7-sig-title",
        "kind": "text",
        "text": "Office of the Principal",
        "x": 640,
        "y": 985,
        "w": 340,
        "h": 35,
        "z": 21,
        "style": {
          "fontFamily": "Merriweather",
          "size": 24,
          "weight": 700,
          "color": "#1D4ED8",
          "align": "center"
        }
      },
      {
        "id": "p7-sig-sub",
        "kind": "text",
        "text": "Sunrise School Administration",
        "x": 640,
        "y": 1025,
        "w": 340,
        "h": 30,
        "z": 22,
        "style": {
          "fontFamily": "Source Sans 3",
          "size": 22,
          "weight": 400,
          "color": "#64748B",
          "align": "center",
          "italic": true
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  },
  {
    "name": "Split Color",
    "category": "Awareness",
    "size": {
      "width": 1080,
      "height": 1350
    },
    "zones": [
      {
        "id": "zone-header",
        "type": "header",
        "x": 0,
        "y": 0,
        "w": 1080,
        "h": 140,
        "locked": true
      },
      {
        "id": "zone-content",
        "type": "content",
        "x": 60,
        "y": 140,
        "w": 960,
        "h": 1080,
        "locked": false,
        "minFont": 22,
        "maxFont": 100
      },
      {
        "id": "zone-footer",
        "type": "footer",
        "x": 0,
        "y": 1220,
        "w": 1080,
        "h": 130,
        "locked": true
      }
    ],
    "elements": [
      {
        "id": "p8-left-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#14532D"
        },
        "x": 60,
        "y": 165,
        "w": 460,
        "h": 975,
        "z": 1,
        "style": {
          "radius": 20
        }
      },
      {
        "id": "p8-left-icon",
        "kind": "icon",
        "name": "leaf",
        "x": 90,
        "y": 200,
        "w": 64,
        "h": 64,
        "z": 2,
        "style": {
          "color": "#6EE7B7"
        }
      },
      {
        "id": "p8-left-overline",
        "kind": "text",
        "text": "COMMUNITY ACTION",
        "x": 90,
        "y": 285,
        "w": 400,
        "h": 30,
        "z": 3,
        "style": {
          "fontFamily": "DM Sans",
          "size": 22,
          "weight": 700,
          "color": "#A7F3D0",
          "letterSpacing": 2,
          "uppercase": true
        }
      },
      {
        "id": "p8-left-title",
        "kind": "field",
        "field": "headline",
        "x": 90,
        "y": 325,
        "w": 400,
        "h": 260,
        "z": 4,
        "style": {
          "fontFamily": "DM Serif Display",
          "size": 100,
          "weight": 400,
          "color": "#FFFFFF",
          "align": "left",
          "lineHeight": 1.05
        }
      },
      {
        "id": "p8-left-tagline",
        "kind": "field",
        "field": "tagline",
        "x": 90,
        "y": 600,
        "w": 400,
        "h": 80,
        "z": 5,
        "style": {
          "fontFamily": "DM Sans",
          "size": 34,
          "weight": 500,
          "color": "#D1FAE5",
          "align": "left"
        }
      },
      {
        "id": "p8-left-date-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#064E3B"
        },
        "x": 90,
        "y": 705,
        "w": 400,
        "h": 180,
        "z": 6,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p8-left-date-label",
        "kind": "text",
        "text": "DATE & TIME",
        "x": 110,
        "y": 725,
        "w": 360,
        "h": 26,
        "z": 7,
        "style": {
          "fontFamily": "DM Sans",
          "size": 22,
          "weight": 700,
          "color": "#A7F3D0"
        }
      },
      {
        "id": "p8-left-date-val",
        "kind": "field",
        "field": "date",
        "x": 110,
        "y": 760,
        "w": 360,
        "h": 50,
        "z": 8,
        "style": {
          "fontFamily": "DM Serif Display",
          "size": 36,
          "weight": 400,
          "color": "#FFFFFF"
        }
      },
      {
        "id": "p8-left-time-val",
        "kind": "field",
        "field": "time",
        "x": 110,
        "y": 815,
        "w": 360,
        "h": 45,
        "z": 9,
        "style": {
          "fontFamily": "DM Sans",
          "size": 28,
          "weight": 700,
          "color": "#ECFDF5"
        }
      },
      {
        "id": "p8-left-venue",
        "kind": "field",
        "field": "venue",
        "x": 90,
        "y": 915,
        "w": 400,
        "h": 70,
        "z": 10,
        "style": {
          "fontFamily": "DM Sans",
          "size": 26,
          "weight": 600,
          "color": "#A7F3D0"
        }
      },
      {
        "id": "p8-right-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#FFFFFF",
          "stroke": "#A7F3D0",
          "strokeWidth": 2
        },
        "x": 550,
        "y": 165,
        "w": 470,
        "h": 820,
        "z": 11,
        "style": {
          "radius": 20
        }
      },
      {
        "id": "p8-right-heading",
        "kind": "text",
        "text": "WHY JOIN US?",
        "x": 580,
        "y": 205,
        "w": 410,
        "h": 45,
        "z": 12,
        "style": {
          "fontFamily": "DM Serif Display",
          "size": 40,
          "weight": 400,
          "color": "#14532D"
        }
      },
      {
        "id": "p8-right-rule",
        "kind": "shape",
        "shape": {
          "type": "line",
          "fill": "#A7F3D0",
          "stroke": "#A7F3D0",
          "strokeWidth": 2
        },
        "x": 580,
        "y": 265,
        "w": 410,
        "h": 2,
        "z": 13
      },
      {
        "id": "p8-check-1",
        "kind": "icon",
        "name": "leaf",
        "x": 580,
        "y": 310,
        "w": 40,
        "h": 40,
        "z": 14,
        "style": {
          "color": "#059669"
        }
      },
      {
        "id": "p8-point-1",
        "kind": "text",
        "text": "Free saplings and spades provided",
        "x": 635,
        "y": 312,
        "w": 355,
        "h": 80,
        "z": 15,
        "style": {
          "fontFamily": "DM Sans",
          "size": 26,
          "weight": 600,
          "color": "#064E3B"
        }
      },
      {
        "id": "p8-check-2",
        "kind": "icon",
        "name": "leaf",
        "x": 580,
        "y": 440,
        "w": 40,
        "h": 40,
        "z": 16,
        "style": {
          "color": "#059669"
        }
      },
      {
        "id": "p8-point-2",
        "kind": "text",
        "text": "Expert arborists guide every planting",
        "x": 635,
        "y": 442,
        "w": 355,
        "h": 80,
        "z": 17,
        "style": {
          "fontFamily": "DM Sans",
          "size": 26,
          "weight": 600,
          "color": "#064E3B"
        }
      },
      {
        "id": "p8-check-3",
        "kind": "icon",
        "name": "leaf",
        "x": 580,
        "y": 570,
        "w": 40,
        "h": 40,
        "z": 18,
        "style": {
          "color": "#059669"
        }
      },
      {
        "id": "p8-point-3",
        "kind": "text",
        "text": "Complimentary refreshments and fruit packs",
        "x": 635,
        "y": 572,
        "w": 355,
        "h": 80,
        "z": 19,
        "style": {
          "fontFamily": "DM Sans",
          "size": 26,
          "weight": 600,
          "color": "#064E3B"
        }
      },
      {
        "id": "p8-quote-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#ECFDF5",
          "stroke": "#6EE7B7",
          "strokeWidth": 1
        },
        "x": 580,
        "y": 700,
        "w": 410,
        "h": 180,
        "z": 20,
        "style": {
          "radius": 14
        }
      },
      {
        "id": "p8-quote-text",
        "kind": "text",
        "text": "“The best time to plant a tree was 20 years ago. The second best time is today.”",
        "x": 600,
        "y": 725,
        "w": 370,
        "h": 130,
        "z": 21,
        "style": {
          "fontFamily": "DM Serif Display",
          "size": 24,
          "weight": 400,
          "color": "#064E3B",
          "italic": true,
          "lineHeight": 1.4
        }
      },
      {
        "id": "p8-cta-plate",
        "kind": "shape",
        "shape": {
          "type": "rect",
          "fill": "#059669"
        },
        "x": 550,
        "y": 1010,
        "w": 470,
        "h": 130,
        "z": 22,
        "style": {
          "radius": 16
        }
      },
      {
        "id": "p8-cta-text",
        "kind": "text",
        "text": "BE A GREEN VOLUNTEER",
        "x": 565,
        "y": 1045,
        "w": 440,
        "h": 50,
        "z": 23,
        "style": {
          "fontFamily": "DM Sans",
          "size": 32,
          "weight": 700,
          "color": "#FFFFFF",
          "align": "center",
          "letterSpacing": 1
        }
      }
    ],
    "editorVersion": 2,
    "isActive": true,
    "isDefault": false,
    "version": 1,
    "versions": []
  }
];

export function createStandardTemplates(clientId) {
  return STANDARD_TEMPLATES.map((t, index) => ({
    ...JSON.parse(JSON.stringify(t)),
    clientId,
    isDefault: index === 0,
  }));
}
