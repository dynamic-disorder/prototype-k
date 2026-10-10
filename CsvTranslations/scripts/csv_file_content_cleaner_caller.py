import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from csv_file_content_cleaner import consolidate_csv_files

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python call_cleaner.py <input_folder> <output_file>")
        sys.exit(1)

    input_folder = sys.argv[1]
    output_file = sys.argv[2]

    print(f"Consolidating CSV files from: {input_folder}")
    print(f"Output will be saved to: {output_file}")

    consolidate_csv_files(input_folder, output_file)
    print("CSV consolidation completed successfully!")