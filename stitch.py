import cv2
import os
import sys

def stitch_images(image_dir, output_path):
    # List all image files in the directory
    image_files = [os.path.join(image_dir, img) for img in os.listdir(image_dir) if img.lower().endswith(('.jpg', '.jpeg', '.png'))]

    if not image_files:
        raise ValueError("No images found in the directory.")

    # Load images
    images = [cv2.imread(img_file) for img_file in image_files]

    # Check if images are loaded properly
    if any(img is None for img in images):
        raise ValueError("Some images could not be loaded.")

    # Create a stitcher and stitch images
    stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
    status, panorama = stitcher.stitch(images)

    if status == cv2.Stitcher_OK:
        cv2.imwrite(output_path, panorama)
        print(f"Panorama saved to {output_path}")
    else:
        print(f"Error stitching images: {status}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python stitch.py <image_dir> <output_path>")
        sys.exit(1)

    image_dir = sys.argv[1]
    output_path = sys.argv[2]
    stitch_images(image_dir, output_path)
