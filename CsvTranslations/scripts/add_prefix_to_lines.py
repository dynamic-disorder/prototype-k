#!/usr/bin/env python3
"""
Script to add a prefix string at the beginning of every line in a file.

Usage:
    python add_prefix_to_lines.py <input_file> <output_file> <prefix>

Example:
    python add_prefix_to_lines.py input.txt output.txt "noTranslationYet,"
"""

import sys

def add_prefix_to_lines(input_file, output_file, prefix):
    """
    Add a prefix to the beginning of every line in the input file
    and write the result to the output file.

    Args:
        input_file (str): Path to the input file
        output_file (str): Path to the output file
        prefix (str): String to add at the beginning of each line
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as infile:
            lines = infile.readlines()

        with open(output_file, 'w', encoding='utf-8') as outfile:
            for line in lines:
                # Add prefix to each line
                new_line = prefix + line
                outfile.write(new_line)

        print(f"Successfully added prefix '{prefix}' to every line.")
        print(f"Input file: {input_file}")
        print(f"Output file: {output_file}")

    except FileNotFoundError:
        print(f"Error: Input file '{input_file}' not found.")
        sys.exit(1)
    except Exception as e:
        print(f"An error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Usage: python add_prefix_to_lines.py <input_file> <output_file> <prefix>")
        print("Example: python add_prefix_to_lines.py input.txt output.txt \"noTranslationYet,\"")
        sys.exit(1)

    input_file = sys.argv[1]
    output_file = sys.argv[2]
    prefix = sys.argv[3]

    add_prefix_to_lines(input_file, output_file, prefix)