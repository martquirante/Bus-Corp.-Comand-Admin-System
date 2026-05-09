export const demoRootData = {
  POS_Devices: {
    POS001: {
      LiveStatus: {
        busNumber: "BUS 101",
        driver: "Ramon Dela Cruz",
        conductor: "Ana Reyes",
        currentLoop: "FVR Terminal -> Sapang Palay",
        totalCash: 12840,
        totalGcash: 8420,
        regularCount: 126,
        studentCount: 41,
        seniorCount: 18,
        speed: 38,
        lat: 14.8114,
        lng: 121.0451,
        lastUpdate: Date.now() - 24000,
        emergencyStatus: false
      },
      Trips: {
        trip_001: {
          Transactions: {
            tx_001: {
              timestamp: Date.now() - 3600000,
              busNo: "BUS 101",
              driver: "Ramon Dela Cruz",
              conductor: "Ana Reyes",
              origin: "FVR Terminal",
              destination: "Sapang Palay",
              passengerType: "Regular",
              passengerCount: 1,
              paymentMethod: "cash",
              totalAmount: 45
            },
            tx_002: {
              timestamp: Date.now() - 2800000,
              busNo: "BUS 101",
              driver: "Ramon Dela Cruz",
              conductor: "Ana Reyes",
              origin: "SM Fairview",
              destination: "St. Cruz",
              passengerType: "Student",
              passengerCount: 1,
              paymentMethod: "gcash",
              totalAmount: 35
            }
          }
        }
      }
    },
    POS002: {
      LiveStatus: {
        busNumber: "BUS 208",
        driver: "Mark Santos",
        conductor: "Lito Cruz",
        currentLoop: "St. Cruz -> FVR Terminal",
        totalCash: 18310,
        totalGcash: 3260,
        regularCount: 143,
        studentCount: 36,
        seniorCount: 22,
        speed: 54,
        lat: 14.782,
        lng: 121.0264,
        lastUpdate: Date.now() - 43000,
        emergencyStatus: false
      },
      Trips: {
        trip_002: {
          Transactions: {
            tx_003: {
              timestamp: Date.now() - 1900000,
              busNo: "BUS 208",
              driver: "Mark Santos",
              conductor: "Lito Cruz",
              origin: "St. Cruz",
              destination: "SM Fairview",
              passengerType: "Senior",
              passengerCount: 1,
              paymentMethod: "cash",
              totalAmount: 32
            }
          }
        }
      }
    },
    POS003: {
      LiveStatus: {
        busNumber: "BUS 314",
        driver: "Joel Ramos",
        conductor: "Mia Garcia",
        currentLoop: "Depot Standby",
        totalCash: 5340,
        totalGcash: 1800,
        regularCount: 38,
        studentCount: 12,
        seniorCount: 8,
        speed: 0,
        lat: 14.8041,
        lng: 121.0048,
        lastUpdate: Date.now() - 88000,
        emergencyStatus: true,
        emergencyReason: "Driver pressed SOS"
      },
      Trips: {
        trip_003: {
          Transactions: {
            tx_004: {
              timestamp: Date.now() - 900000,
              busNo: "BUS 314",
              driver: "Joel Ramos",
              conductor: "Mia Garcia",
              origin: "Depot",
              destination: "FVR Terminal",
              passengerType: "Regular",
              passengerCount: 2,
              paymentMethod: "mixed",
              totalAmount: 90
            }
          }
        }
      }
    }
  },
  Expenses: {
    exp_001: {
      type: "Fuel",
      amount: 6500,
      bus: "BUS 101",
      notes: "Diesel refill",
      timestamp: Date.now() - 7200000,
      addedBy: "System Owner"
    },
    exp_002: {
      type: "Maintenance",
      amount: 2200,
      bus: "BUS 314",
      notes: "Brake inspection",
      timestamp: Date.now() - 10800000,
      addedBy: "System Owner"
    }
  },
  AssistanceRequests: {
    assist_001: {
      busNumber: "BUS 314",
      requester: "Joel Ramos",
      reason: "Driver pressed SOS",
      status: "pending",
      timestamp: Date.now() - 88000
    }
  },
  messages: {
    msg_001: {
      sender: "Dispatch",
      title: "Route monitoring",
      message: "Keep monitoring FVR Terminal dispatch spacing during peak hour.",
      status: "unread",
      timestamp: Date.now() - 420000
    }
  },
  Routes_Forward: {
    route_fwd_01: {
      origin: "FVR Terminal",
      destination: "SM Fairview",
      price: 25,
      distance: 5.8
    },
    route_fwd_02: {
      origin: "SM Fairview",
      destination: "Sapang Palay",
      price: 45,
      distance: 12.4
    }
  },
  Routes_Reverse: {
    route_rev_01: {
      origin: "Sapang Palay",
      destination: "SM Fairview",
      price: 45,
      distance: 12.4
    },
    route_rev_02: {
      origin: "SM Fairview",
      destination: "FVR Terminal",
      price: 25,
      distance: 5.8
    }
  },
  AdminRoutes: {
    "fvr-terminal-to-gma-kamuning": {
      routeId: "fvr-terminal-to-gma-kamuning",
      routeName: "FVR Terminal to GMA Kamuning",
      origin: "FVR Terminal",
      destination: "GMA Kamuning",
      direction: "forward",
      isViceVersa: true,
      reverseRouteId: "gma-kamuning-to-fvr-terminal",
      status: "active",
      baseFare: 25,
      farePerKm: 2,
      price: 25,
      stops: [],
      waypoints: []
    }
  },
  Users: {
    Pending: {
      user_pending_01: {
        fullName: "Carlo Mendoza",
        email: "carlo@example.com",
        role: "Conductor"
      }
    },
    Active: {
      user_active_01: {
        fullName: "Ana Reyes",
        email: "ana@example.com",
        role: "Conductor",
        dateApproved: new Date(Date.now() - 86400000).toISOString()
      }
    }
  },
  SuperAdmins: {
    admin_posticketing_com: {
      name: "System Owner",
      password: "admin123",
      role: "SuperAdmin",
      email: "admin@posticketing.com"
    }
  },
  Config: {
    GlobalSettings: {
      adminPasscode: "123456"
    }
  }
};
