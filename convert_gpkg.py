#!/usr/bin/env python3
"""
Конвертация GeoPackage файла Узбекистана в GeoJSON для использования в Leaflet
"""

import geopandas as gpd
import fiona
import json
import os

def convert_gpkg_to_geojson():
    """Конвертирует gadm41_UZB.gpkg в GeoJSON формат"""
    
    # Путь к файлу
    gpkg_path = "frontend/gadm41_UZB.gpkg"
    output_path = "frontend/uzbekistan_boundaries.geojson"
    
    try:
        print("Загружаем GeoPackage файл...")
        
        # Читаем GeoPackage файл
        # Сначала попробуем прочитать все слои
        layers = fiona.listlayers(gpkg_path)
        print(f"Доступные слои: {layers}")
        
        # Обычно в GADM файлах есть слои с разными уровнями административного деления
        # Попробуем найти слой с границами страны (уровень 0)
        country_layer = None
        for layer in layers:
            if '0' in layer or 'country' in layer.lower():
                country_layer = layer
                break
        
        if not country_layer:
            # Если не нашли, берем первый слой
            country_layer = layers[0]
        
        print(f"Используем слой: {country_layer}")
        
        # Читаем данные
        gdf = gpd.read_file(gpkg_path, layer=country_layer)
        
        print(f"Загружено {len(gdf)} объектов")
        print(f"Колонки: {list(gdf.columns)}")
        
        # Убеждаемся, что CRS правильный (WGS84)
        if gdf.crs != 'EPSG:4326':
            print(f"Конвертируем CRS с {gdf.crs} в EPSG:4326")
            gdf = gdf.to_crs('EPSG:4326')
        
        # Упрощаем геометрию для веб-использования (уменьшаем размер файла)
        print("Упрощаем геометрию...")
        gdf['geometry'] = gdf['geometry'].simplify(tolerance=0.001, preserve_topology=True)
        
        # Сохраняем в GeoJSON
        print(f"Сохраняем в {output_path}...")
        gdf.to_file(output_path, driver='GeoJSON')
        
        # Получаем размер файла
        file_size = os.path.getsize(output_path) / 1024 / 1024  # MB
        print(f"Конвертация завершена! Размер файла: {file_size:.2f} MB")
        
        # Показываем информацию о данных
        print("\nИнформация о данных:")
        print(f"- Количество объектов: {len(gdf)}")
        print(f"- CRS: {gdf.crs}")
        print(f"- Bounds: {gdf.total_bounds}")
        
        if 'NAME_0' in gdf.columns:
            print(f"- Страны: {gdf['NAME_0'].unique()}")
        if 'NAME_1' in gdf.columns:
            print(f"- Регионы: {gdf['NAME_1'].unique()}")
            
        return True
        
    except Exception as e:
        print(f"Ошибка при конвертации: {e}")
        return False

if __name__ == "__main__":
    convert_gpkg_to_geojson()
