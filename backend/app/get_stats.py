import os
import pandas as pd

COLUMNS = ["unit", "cycle", "setting1", "setting2", "setting3"] + [f"s{i}" for i in range(1, 22)]
DROP_SENSORS = ["s1", "s5", "s6", "s10", "s16", "s18", "s19"]
KEEP_SENSORS = [f"s{i}" for i in range(1, 22) if f"s{i}" not in DROP_SENSORS]

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))
TRAIN_PATH = os.path.join(DATA_DIR, "train_FD001.txt")

df = pd.read_csv(TRAIN_PATH, sep=r"\s+", header=None, names=COLUMNS)

# Let's group by unit and compute remaining useful life (RUL)
max_cycles = df.groupby("unit")["cycle"].max().reset_index()
max_cycles.columns = ["unit", "max_cycle"]
df = df.merge(max_cycles, on="unit")
df["RUL"] = df["max_cycle"] - df["cycle"]

print("Overall Ranges:")
for col in KEEP_SENSORS:
    print(f"{col}: min={df[col].min():.4f}, max={df[col].max():.4f}, mean={df[col].mean():.4f}")

print("\nEarly stage (RUL > 100):")
early_df = df[df["RUL"] > 100]
for col in KEEP_SENSORS:
    print(f"{col}: mean={early_df[col].mean():.4f}")

print("\nMid stage (RUL 50-70):")
mid_df = df[(df["RUL"] >= 50) & (df["RUL"] <= 70)]
for col in KEEP_SENSORS:
    print(f"{col}: mean={mid_df[col].mean():.4f}")

print("\nLate stage (RUL < 25):")
late_df = df[df["RUL"] < 25]
for col in KEEP_SENSORS:
    print(f"{col}: mean={late_df[col].mean():.4f}")
